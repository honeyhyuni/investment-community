import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { inflateRawSync } from 'node:zlib';
import { Between, In, Not, Repository } from 'typeorm';
import { IpoCalendarEntity } from './ipo-calendar.entity';

type DartDisclosure = {
  corp_code?: string;
  corp_name?: string;
  stock_code?: string;
  corp_cls?: string;
  report_nm?: string;
  rcept_no?: string;
  flr_nm?: string;
  rcept_dt?: string;
  rm?: string;
};

type DartListResponse = {
  status?: string;
  message?: string;
  page_no?: number;
  total_page?: number;
  list?: DartDisclosure[];
};

type DartEquitySecuritiesResponse = {
  status?: string;
  message?: string;
  group?: Array<{
    title?: string;
    list?: Array<Record<string, string | undefined>>;
  }>;
};

type ParsedEquityFiling = {
  receiptNo: string;
  corpCode: string;
  corpName: string;
  corpClass: string | null;
  subscriptionStartDate: string;
  subscriptionEndDate: string | null;
  subscriptionDateText: string;
  expectedOfferPrice: string | null;
  underwriter: string | null;
  offeringMethod: string | null;
};

@Injectable()
export class IpoCalendarBatchService {
  private readonly logger = new Logger(IpoCalendarBatchService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(IpoCalendarEntity)
    private readonly ipoRepository: Repository<IpoCalendarEntity>,
  ) {}

  @Cron('0 0 3 * * *', { timeZone: 'Asia/Seoul' })
  async refreshDailyIpoCalendar(): Promise<void> {
    if (!this.scheduledJobsEnabled()) {
      return;
    }

    const result = await this.refreshUpcomingIpos();
    this.logger.log(
      `Daily IPO calendar batch completed: scanned=${result.scanned}, updated=${result.updated}, failed=${result.failed}.`,
    );
  }

  async getUpcomingIpos(): Promise<IpoCalendarEntity[]> {
    const today = this.formatDate(this.kstDate());
    const oneMonthLater = this.formatDate(this.addDays(this.kstDate(), 31));
    return this.ipoRepository
      .createQueryBuilder('ipo')
      .where('ipo.subscription_start_date <= :windowEnd', {
        windowEnd: oneMonthLater,
      })
      .andWhere(
        'coalesce(ipo.subscription_end_date, ipo.subscription_start_date) >= :windowStart',
        { windowStart: today },
      )
      .orderBy('ipo.subscription_start_date', 'ASC')
      .addOrderBy('ipo.corp_name', 'ASC')
      .getMany();
  }

  async refreshUpcomingIpos(): Promise<{
    scanned: number;
    updated: number;
    failed: number;
  }> {
    const apiKey = this.configService.get<string>('DART_API_KEY');
    if (!apiKey) {
      this.logger.warn('IPO calendar batch skipped: DART_API_KEY is missing.');
      return { scanned: 0, updated: 0, failed: 0 };
    }

    const today = this.kstDate();
    const from = this.formatDateCompact(this.addDays(today, -90));
    const to = this.formatDateCompact(today);
    const windowStart = this.formatDate(today);
    const windowEnd = this.formatDate(this.addDays(today, 31));
    const disclosures = await this.fetchIpoDisclosures(apiKey, from, to);
    const disclosureByReceiptNo = new Map(
      disclosures
        .filter((item) => item.rcept_no)
        .map((item) => [item.rcept_no!, item]),
    );
    const corpCodes = [
      ...new Set(
        disclosures
          .map((item) => item.corp_code)
          .filter((corpCode): corpCode is string => !!corpCode),
      ),
    ];

    let updated = 0;
    let failed = 0;
    const activeReceiptNos = new Set<string>();
    for (const corpCode of corpCodes) {
      try {
        const filings = await this.fetchEquitySecuritiesFilings(
          apiKey,
          corpCode,
          from,
          to,
        );
        for (const filing of filings) {
          if (!this.isPublicIpoFiling(filing)) {
            continue;
          }
          const correctedFiling = await this.applyDocumentScheduleCorrection(
            apiKey,
            filing,
          );
          const subscriptionEndDate =
            correctedFiling.subscriptionEndDate ??
            correctedFiling.subscriptionStartDate;
          if (
            subscriptionEndDate < windowStart ||
            correctedFiling.subscriptionStartDate > windowEnd
          ) {
            continue;
          }

          const disclosure = disclosureByReceiptNo.get(correctedFiling.receiptNo);
          await this.ipoRepository.upsert(
            {
              corpCode: correctedFiling.corpCode,
              corpName: correctedFiling.corpName,
              stockCode: disclosure?.stock_code?.trim() || null,
              reportName:
                disclosure?.report_nm ?? '증권신고서(지분증권) 주요정보',
              receiptNo: correctedFiling.receiptNo,
              receiptDate:
                this.formatDartDate(disclosure?.rcept_dt) ?? windowStart,
              subscriptionStartDate: correctedFiling.subscriptionStartDate,
              subscriptionEndDate: correctedFiling.subscriptionEndDate,
              subscriptionDateText: correctedFiling.subscriptionDateText,
              expectedOfferPrice: correctedFiling.expectedOfferPrice,
              underwriter: correctedFiling.underwriter,
              dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${correctedFiling.receiptNo}`,
              source: 'dart_estkrs_batch',
              raw: {
                corpClass: correctedFiling.corpClass ?? undefined,
                offeringMethod: correctedFiling.offeringMethod ?? undefined,
                scheduleSource:
                  correctedFiling.subscriptionDateText === filing.subscriptionDateText
                    ? 'estkrs'
                    : 'document_xml',
                reportName: disclosure?.report_nm,
                receiptDate: disclosure?.rcept_dt,
              },
            },
            ['receiptNo'],
          );
          activeReceiptNos.add(correctedFiling.receiptNo);
          updated += 1;
        }
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `IPO equity securities request failed for ${corpCode}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    await this.removeStaleUpcomingRows(windowStart, windowEnd, activeReceiptNos);

    return { scanned: disclosures.length, updated, failed };
  }

  private async fetchIpoDisclosures(
    apiKey: string,
    beginDate: string,
    endDate: string,
  ): Promise<DartDisclosure[]> {
    const rows: DartDisclosure[] = [];
    for (let pageNo = 1; pageNo <= 100; pageNo += 1) {
      const url = new URL('https://opendart.fss.or.kr/api/list.json');
      url.searchParams.set('crtfc_key', apiKey);
      url.searchParams.set('bgn_de', beginDate);
      url.searchParams.set('end_de', endDate);
      url.searchParams.set('pblntf_ty', 'C');
      url.searchParams.set('pblntf_detail_ty', 'C001');
      url.searchParams.set('page_no', String(pageNo));
      url.searchParams.set('page_count', '100');
      url.searchParams.set('last_reprt_at', 'N');

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`DART disclosure list request failed: ${response.status}`);
      }

      const body = (await response.json()) as DartListResponse;
      if (body.status && body.status !== '000' && body.status !== '013') {
        throw new Error(
          `DART disclosure list failed: ${body.status} ${body.message ?? ''}`.trim(),
        );
      }

      const nextRows = (body.list ?? []).filter((item) => {
        const reportName = item.report_nm ?? '';
        return (
          /(증권신고서\(지분증권\)|투자설명서)/.test(reportName) &&
          !/(소액공모|집합투자증권|파생결합증권|채무증권)/.test(reportName)
        );
      });
      rows.push(...nextRows);

      if (!body.total_page || pageNo >= body.total_page) {
        break;
      }
    }
    return rows;
  }

  private async fetchEquitySecuritiesFilings(
    apiKey: string,
    corpCode: string,
    beginDate: string,
    endDate: string,
  ): Promise<ParsedEquityFiling[]> {
    const url = new URL('https://opendart.fss.or.kr/api/estkRs.json');
    url.searchParams.set('crtfc_key', apiKey);
    url.searchParams.set('corp_code', corpCode);
    url.searchParams.set('bgn_de', beginDate);
    url.searchParams.set('end_de', endDate);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`DART equity securities request failed: ${response.status}`);
    }

    const body = (await response.json()) as DartEquitySecuritiesResponse;
    if (body.status === '013') {
      return [];
    }
    if (body.status && body.status !== '000') {
      throw new Error(
        `DART equity securities failed: ${body.status} ${body.message ?? ''}`.trim(),
      );
    }

    const generalRows = this.findEquityGroupRows(body, '일반사항');
    const securityRows = this.findEquityGroupRows(body, '증권의종류');
    const underwriterRows = this.findEquityGroupRows(body, '인수인정보');
    const securityByReceiptNo = this.groupByReceiptNo(securityRows);
    const underwriterByReceiptNo = this.groupByReceiptNo(underwriterRows);

    return generalRows
      .map((row) => {
        const receiptNo = row.rcept_no;
        const subscription = this.parseSubscriptionDate(row.sbd);
        if (!receiptNo || !row.corp_code || !row.corp_name || !subscription.startDate) {
          return null;
        }
        const security = securityByReceiptNo.get(receiptNo)?.[0];
        const underwriters = [
          ...new Set(
            (underwriterByReceiptNo.get(receiptNo) ?? [])
              .map((item) => item.actnmn?.trim())
              .filter((value): value is string => !!value),
          ),
        ];
        return {
          receiptNo,
          corpCode: row.corp_code,
          corpName: row.corp_name,
          corpClass: row.corp_cls ?? null,
          subscriptionStartDate: subscription.startDate,
          subscriptionEndDate: subscription.endDate,
          subscriptionDateText: subscription.label,
          expectedOfferPrice: security?.slprc?.trim() || null,
          underwriter: underwriters.length ? underwriters.join(', ') : null,
          offeringMethod: security?.slmthn?.trim() || null,
        };
      })
      .filter((row): row is ParsedEquityFiling => !!row);
  }

  private isPublicIpoFiling(filing: ParsedEquityFiling): boolean {
    const method = filing.offeringMethod ?? '';
    if (/주주배정|주주우선|실권주|구주주|유상증자|제3자배정/.test(method)) {
      return false;
    }
    return /일반공모|공모/.test(method);
  }

  private async applyDocumentScheduleCorrection(
    apiKey: string,
    filing: ParsedEquityFiling,
  ): Promise<ParsedEquityFiling> {
    const text = await this.fetchDartDocumentText(apiKey, filing.receiptNo).catch(
      () => '',
    );
    if (!text) {
      return filing;
    }

    const correctedSchedule =
      this.extractLatestGeneralSubscriptionDate(text) ??
      this.extractInvestorSubscriptionSentence(text) ??
      this.extractLastSubscriptionDueDate(text) ??
      this.extractRetailSubscriptionDate(text) ??
      this.extractCorrectedSubscriptionDate(text);
    if (!correctedSchedule?.startDate || !this.isUsableCorrection(filing, correctedSchedule)) {
      return filing;
    }

    return {
      ...filing,
      subscriptionStartDate: correctedSchedule.startDate,
      subscriptionEndDate: correctedSchedule.endDate,
      subscriptionDateText: correctedSchedule.label,
    };
  }

  private async fetchDartDocumentText(
    apiKey: string,
    receiptNo: string,
  ): Promise<string> {
    const url = new URL('https://opendart.fss.or.kr/api/document.xml');
    url.searchParams.set('crtfc_key', apiKey);
    url.searchParams.set('rcept_no', receiptNo);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`DART document request failed: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const xml = this.decodeDartDocumentXml(this.extractFirstZipEntry(buffer));
    return xml
      .replace(/<!\[CDATA\[|\]\]>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private decodeDartDocumentXml(xmlBuffer: Buffer): string {
    const header = xmlBuffer.subarray(0, 240).toString('latin1');
    const encodingMatch = /encoding=["']([^"']+)["']/i.exec(header);
    const encoding = encodingMatch?.[1]?.toLowerCase() ?? 'utf-8';
    if (/euc-?kr|ks_c_5601|cp949/.test(encoding)) {
      return new TextDecoder('euc-kr').decode(xmlBuffer);
    }
    return new TextDecoder('utf-8').decode(xmlBuffer);
  }

  private extractCorrectedSubscriptionDate(text: string): {
    startDate: string | null;
    endDate: string | null;
    label: string;
  } | null {
    const correctedIndex = text.search(/정정\s*후/);
    const targetIndex = text.search(/(청약기일|일반청약자\s*청약일)/);
    const start = correctedIndex >= 0 ? correctedIndex : targetIndex;
    if (start < 0) {
      return null;
    }
    const nearby = text.slice(start, start + 2600);
    const scheduleIndex = nearby.search(/(청약기일|일반청약자\s*청약일)/);
    const focused = scheduleIndex >= 0 ? nearby.slice(scheduleIndex, scheduleIndex + 700) : nearby;
    return this.extractFirstDateRange(focused);
  }

  private extractInvestorSubscriptionSentence(text: string): {
    startDate: string | null;
    endDate: string | null;
    label: string;
  } | null {
    const matches = [
      ...text.matchAll(
        /(기관투자자.{0,80}일반(?:청약자|투자자).{0,80}청약은|일반(?:청약자|투자자).{0,80}청약은)\s*(.{0,260})/g,
      ),
    ];
    const match = matches.at(-1);
    if (!match?.[2]) {
      return null;
    }
    return this.extractFirstDateRange(match[2]);
  }

  private extractLatestGeneralSubscriptionDate(text: string): {
    startDate: string | null;
    endDate: string | null;
    label: string;
  } | null {
    const snippets = [
      ...this.extractDateSnippets(text, /일반청약자\s*청약일\s*[:：-]?\s*(.{0,220})/g),
      ...this.extractDateSnippets(text, /일반청약자(?:의)?\s*청약은\s*(.{0,220})/g),
      ...this.extractDateSnippets(text, /일반투자자(?:의)?\s*청약은\s*(.{0,220})/g),
      ...this.extractDateSnippets(text, /기관투자자\s*및\s*일반청약자(?:의)?\s*청약은\s*(.{0,220})/g),
      ...this.extractDateSnippets(text, /기관투자자.{0,80}일반(?:청약자|투자자).{0,80}청약은\s*(.{0,220})/g),
    ];
    const schedules = snippets
      .map((snippet) => this.extractFirstDateRange(snippet))
      .filter(
        (
          schedule,
        ): schedule is {
          startDate: string | null;
          endDate: string | null;
          label: string;
        } =>
          !!schedule?.startDate &&
          !!schedule.endDate &&
          schedule.endDate > schedule.startDate,
      )
      .sort((left, right) => {
        const leftEnd = left.endDate ?? left.startDate ?? '';
        const rightEnd = right.endDate ?? right.startDate ?? '';
        return `${left.startDate ?? ''}${leftEnd}`.localeCompare(
          `${right.startDate ?? ''}${rightEnd}`,
        );
      });
    return schedules.at(-1) ?? null;
  }

  private extractDateSnippets(text: string, pattern: RegExp): string[] {
    return [...text.matchAll(pattern)]
      .map((match) => match[1]?.trim())
      .filter((value): value is string => !!value);
  }

  private extractLastSubscriptionDueDate(text: string): {
    startDate: string | null;
    endDate: string | null;
    label: string;
  } | null {
    const matches = [...text.matchAll(/청약기일.{0,700}/g)]
      .map((match) => this.extractFirstDateRange(match[0]))
      .filter(
        (
          schedule,
        ): schedule is {
          startDate: string | null;
          endDate: string | null;
          label: string;
        } => !!schedule?.startDate,
      );
    return matches.at(-1) ?? null;
  }

  private extractRetailSubscriptionDate(text: string): {
    startDate: string | null;
    endDate: string | null;
    label: string;
  } | null {
    const matches = [
      ...text.matchAll(
        /(일반청약자\s*청약일|일반\s*청약자\s*청약|일반투자자.*?청약일)\s*[:：-]?\s*(.{0,700})/g,
      ),
    ];
    const match = matches.at(-1);
    if (!match?.[2]) {
      return null;
    }
    return this.extractFirstDateRange(match[2]);
  }

  private isUsableCorrection(
    filing: ParsedEquityFiling,
    correction: {
      startDate: string | null;
      endDate: string | null;
      label: string;
    },
  ): boolean {
    if (!correction.startDate) {
      return false;
    }
    const endDate = correction.endDate ?? correction.startDate;
    if (endDate < correction.startDate) {
      return false;
    }
    const start = new Date(`${correction.startDate}T00:00:00+09:00`);
    const end = new Date(`${endDate}T00:00:00+09:00`);
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (days < 1 || days > 10) {
      return false;
    }
    if (
      filing.subscriptionEndDate &&
      filing.subscriptionEndDate !== filing.subscriptionStartDate &&
      endDate === correction.startDate
    ) {
      return false;
    }
    return true;
  }

  private extractFirstDateRange(text: string): {
    startDate: string | null;
    endDate: string | null;
    label: string;
  } | null {
    const normalized = text.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ');
    const explicitKoreanRange = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?\s*(?:~|-|∼|부터)\s*(?:(\d{4})\s*년\s*)?(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일?/.exec(
      normalized,
    );
    if (explicitKoreanRange) {
      const startDate = `${explicitKoreanRange[1]}-${explicitKoreanRange[2].padStart(2, '0')}-${explicitKoreanRange[3].padStart(2, '0')}`;
      const endYear = explicitKoreanRange[4] ?? explicitKoreanRange[1];
      const endMonth = explicitKoreanRange[5] ?? explicitKoreanRange[2];
      const endDate = `${endYear}-${endMonth.padStart(2, '0')}-${explicitKoreanRange[6].padStart(2, '0')}`;
      return {
        startDate,
        endDate,
        label: this.formatScheduleLabel(startDate, endDate),
      };
    }

    const explicitNumericRange = /(\d{4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*(?:~|-|∼|부터)\s*(?:(\d{4})\s*[.\/-]\s*)?(\d{1,2})\s*[.\/-]\s*(\d{1,2})/.exec(
      normalized,
    );
    if (explicitNumericRange) {
      const startDate = `${explicitNumericRange[1]}-${explicitNumericRange[2].padStart(2, '0')}-${explicitNumericRange[3].padStart(2, '0')}`;
      const endYear = explicitNumericRange[4] ?? explicitNumericRange[1];
      const endDate = `${endYear}-${explicitNumericRange[5].padStart(2, '0')}-${explicitNumericRange[6].padStart(2, '0')}`;
      return {
        startDate,
        endDate,
        label: this.formatScheduleLabel(startDate, endDate),
      };
    }

    const startMatch = /(\d{4})\s*(?:년|[.\/-])\s*(\d{1,2})\s*(?:월|[.\/-])\s*(\d{1,2})\s*(?:일)?/.exec(
      normalized,
    );
    if (!startMatch || startMatch.index === undefined) {
      return null;
    }
    const startDate = `${startMatch[1]}-${startMatch[2].padStart(2, '0')}-${startMatch[3].padStart(2, '0')}`;
    const tail = normalized.slice(startMatch.index + startMatch[0].length, startMatch.index + startMatch[0].length + 160);
    if (!/(~|-|∼|부터)/.test(tail)) {
      return {
        startDate,
        endDate: startDate,
        label: this.formatScheduleLabel(startDate, startDate),
      };
    }

    const fullEndMatch = /(\d{4})\s*(?:년|[.\/-])\s*(\d{1,2})\s*(?:월|[.\/-])\s*(\d{1,2})\s*(?:일)?/.exec(
      tail,
    );
    const monthDayEndMatch = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(tail);
    const dayEndMatch = /(\d{1,2})\s*일/.exec(tail);
    const endDate = fullEndMatch
      ? `${fullEndMatch[1]}-${fullEndMatch[2].padStart(2, '0')}-${fullEndMatch[3].padStart(2, '0')}`
      : monthDayEndMatch
        ? `${startMatch[1]}-${monthDayEndMatch[1].padStart(2, '0')}-${monthDayEndMatch[2].padStart(2, '0')}`
        : dayEndMatch
          ? `${startMatch[1]}-${startMatch[2].padStart(2, '0')}-${dayEndMatch[1].padStart(2, '0')}`
          : startDate;
    return {
      startDate,
      endDate,
      label: this.formatScheduleLabel(startDate, endDate),
    };
  }

  private formatScheduleLabel(startDate: string, endDate: string | null): string {
    const safeEndDate = endDate ?? startDate;
    return `${this.formatKoreanDateLabel(startDate)} ~ ${this.formatKoreanDateLabel(safeEndDate)}`;
  }

  private extractFirstZipEntry(zip: Buffer): Buffer {
    let eocd = -1;
    for (let index = zip.length - 22; index >= 0; index -= 1) {
      if (zip.readUInt32LE(index) === 0x06054b50) {
        eocd = index;
        break;
      }
    }
    if (eocd < 0) {
      throw new Error('ZIP end record not found.');
    }

    const centralOffset = zip.readUInt32LE(eocd + 16);
    const method = zip.readUInt16LE(centralOffset + 10);
    const compressedSize = zip.readUInt32LE(centralOffset + 20);
    const localOffset = zip.readUInt32LE(centralOffset + 42);
    const fileNameLength = zip.readUInt16LE(localOffset + 26);
    const extraLength = zip.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + fileNameLength + extraLength;
    const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);

    if (method === 0) {
      return compressed;
    }
    if (method === 8) {
      return inflateRawSync(compressed);
    }
    throw new Error(`Unsupported ZIP compression method: ${method}`);
  }

  private findEquityGroupRows(
    body: DartEquitySecuritiesResponse,
    title: string,
  ): Array<Record<string, string | undefined>> {
    return (
      body.group?.find((group) => group.title === title)?.list?.filter(Boolean) ??
      []
    );
  }

  private groupByReceiptNo(
    rows: Array<Record<string, string | undefined>>,
  ): Map<string, Array<Record<string, string | undefined>>> {
    const result = new Map<string, Array<Record<string, string | undefined>>>();
    for (const row of rows) {
      if (!row.rcept_no) {
        continue;
      }
      result.set(row.rcept_no, [...(result.get(row.rcept_no) ?? []), row]);
    }
    return result;
  }

  private normalizeKoreanDate(value: string): string | null {
    const match = value.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!match) {
      return null;
    }
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }

  private parseSubscriptionDate(value?: string): {
    startDate: string | null;
    endDate: string | null;
    label: string;
  } {
    const text = value?.trim() ?? '';
    const dateMatches = [...text.matchAll(/(\d{4}\D+\d{1,2}\D+\d{1,2})/g)]
      .map((match) => this.normalizeKoreanDate(match[1]))
      .filter((date): date is string => !!date);
    const startDate = dateMatches[0] ?? null;
    const endDate = dateMatches[1] ?? startDate;
    return {
      startDate,
      endDate,
      label:
        text ||
        (startDate && endDate && startDate !== endDate
          ? `${startDate} ~ ${endDate}`
          : startDate ?? ''),
    };
  }

  private formatDartDate(value?: string): string | null {
    if (!value || !/^\d{8}$/.test(value)) {
      return null;
    }
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  private async removeStaleUpcomingRows(
    windowStart: string,
    windowEnd: string,
    activeReceiptNos: Set<string>,
  ): Promise<void> {
    if (!activeReceiptNos.size) {
      return;
    }
    await this.ipoRepository
      .createQueryBuilder()
      .delete()
      .where('subscription_start_date <= :windowEnd', { windowEnd })
      .andWhere(
        'coalesce(subscription_end_date, subscription_start_date) >= :windowStart',
        { windowStart },
      )
      .andWhere('receipt_no not in (:...receiptNos)', {
        receiptNos: [...activeReceiptNos],
      })
      .execute();
  }

  private formatKoreanDateLabel(value: string): string {
    const [year, month, day] = value.split('-');
    return `${year}년 ${month}월 ${day}일`;
  }

  private scheduledJobsEnabled(): boolean {
    return this.configService.get<string>('ENABLE_SCHEDULED_JOBS') === 'true';
  }

  private kstDate(): Date {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  private formatDateCompact(date: Date): string {
    return this.formatDate(date).replace(/-/g, '');
  }
}
