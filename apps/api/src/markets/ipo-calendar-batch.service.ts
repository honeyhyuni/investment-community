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

type KindListingSchedule = {
  corpName: string;
  listingDate: string;
  listingDateText: string;
};

type ThirtyEightIpoListItem = {
  corpName: string;
  detailUrl: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
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
      .where(
        `(
          ipo.subscription_start_date <= :windowEnd
          and coalesce(ipo.subscription_end_date, ipo.subscription_start_date) >= :windowStart
        )`,
        {
          windowStart: today,
          windowEnd: oneMonthLater,
        },
      )
      .orWhere(
        'ipo.listing_date is not null and ipo.listing_date between :windowStart and :windowEnd',
        {
          windowStart: today,
          windowEnd: oneMonthLater,
        },
      )
      .orderBy('coalesce(ipo.subscription_start_date, ipo.listing_date)', 'ASC')
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
    const retentionStart = this.formatDate(this.addDays(today, -31));
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
            subscriptionEndDate < retentionStart ||
            correctedFiling.subscriptionStartDate > windowEnd
          ) {
            continue;
          }

          const disclosure = disclosureByReceiptNo.get(correctedFiling.receiptNo);
          const confirmedOfferPrice = this.isDateInRange(
            windowStart,
            correctedFiling.subscriptionStartDate,
            subscriptionEndDate,
          )
            ? await this.fetchConfirmedOfferPrice(
                apiKey,
                correctedFiling,
                disclosures,
                from,
                to,
              )
            : null;
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
              confirmedOfferPrice,
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
                confirmedOfferPriceSource: confirmedOfferPrice
                  ? 'dart_confirmed_conditions_document'
                  : undefined,
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

    const listingSchedules = await this.fetchKindListingSchedules(today, this.addDays(today, 31));
    const listingUpdated = await this.applyListingSchedules(
      listingSchedules,
      retentionStart,
      windowEnd,
      'kind_pubofrschdl',
      false,
    );
    updated += listingUpdated;

    const thirtyEightUpdated = await this.applyThirtyEightTodayListingSchedules(
      windowStart,
    );
    updated += thirtyEightUpdated;

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

  private async fetchConfirmedOfferPrice(
    apiKey: string,
    filing: ParsedEquityFiling,
    disclosures: DartDisclosure[],
    beginDate: string,
    endDate: string,
  ): Promise<string | null> {
    const conditionDisclosure =
      this.findConfirmedConditionDisclosure(disclosures, filing) ??
      this.findConfirmedConditionDisclosure(
        await this.fetchCorpDisclosures(apiKey, filing.corpCode, beginDate, endDate),
        filing,
      );
    if (!conditionDisclosure?.rcept_no) {
      return null;
    }

    const text = await this.fetchDartDocumentText(
      apiKey,
      conditionDisclosure.rcept_no,
    ).catch(() => '');
    if (!text) {
      return null;
    }
    return this.extractConfirmedOfferPrice(text);
  }

  private findConfirmedConditionDisclosure(
    disclosures: DartDisclosure[],
    filing: ParsedEquityFiling,
  ): DartDisclosure | null {
    return (
      disclosures
        .filter((item) => item.corp_code === filing.corpCode && item.rcept_no)
        .filter((item) => {
          const reportName = item.report_nm ?? '';
          return /발행조건확정/.test(reportName) && /증권신고서|지분증권/.test(reportName);
        })
        .sort((left, right) =>
          `${right.rcept_dt ?? ''}${right.rcept_no ?? ''}`.localeCompare(
            `${left.rcept_dt ?? ''}${left.rcept_no ?? ''}`,
          ),
        )[0] ?? null
    );
  }

  private async fetchCorpDisclosures(
    apiKey: string,
    corpCode: string,
    beginDate: string,
    endDate: string,
  ): Promise<DartDisclosure[]> {
    const url = new URL('https://opendart.fss.or.kr/api/list.json');
    url.searchParams.set('crtfc_key', apiKey);
    url.searchParams.set('corp_code', corpCode);
    url.searchParams.set('bgn_de', beginDate);
    url.searchParams.set('end_de', endDate);
    url.searchParams.set('page_count', '100');
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`DART corp disclosure list request failed: ${response.status}`);
    }
    const body = (await response.json()) as DartListResponse;
    if (body.status && body.status !== '000' && body.status !== '013') {
      throw new Error(
        `DART corp disclosure list failed: ${body.status} ${body.message ?? ''}`.trim(),
      );
    }
    return body.list ?? [];
  }

  private extractConfirmedOfferPrice(text: string): string | null {
    const patterns = [
      /모집\(매출\)\s*확정가액\s*[:：]?\s*([0-9,]+)\s*원/,
      /주당\s*확정공모가액\s*[:：]?\s*([0-9,]+)\s*원/,
      /확정공모가(?:격|액)?\s*[:：]?\s*([0-9,]+)\s*원/,
      /공모가액\s*확정[^0-9]{0,120}([0-9,]+)\s*원/,
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  private isDateInRange(date: string, startDate: string, endDate: string): boolean {
    return startDate <= date && date <= endDate;
  }

  private async fetchKindListingSchedules(
    fromDate: Date,
    toDate: Date,
  ): Promise<KindListingSchedule[]> {
    const schedules: KindListingSchedule[] = [];
    const months = this.monthKeysBetween(fromDate, toDate);
    for (const month of months) {
      try {
        schedules.push(...(await this.fetchKindListingSchedulesForMonth(month)));
      } catch (error) {
        this.logger.warn(
          `KIND IPO listing schedule request failed for ${month.year}-${month.month}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const from = this.formatDate(fromDate);
    const to = this.formatDate(toDate);
    return schedules.filter(
      (schedule) => schedule.listingDate >= from && schedule.listingDate <= to,
    );
  }

  private async applyThirtyEightTodayListingSchedules(today: string): Promise<number> {
    try {
      return await this.applyThirtyEightTodayListingSchedulesUnsafe(today);
    } catch (error) {
      this.logger.warn(
        `38 IPO listing schedule fallback skipped: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return 0;
    }
  }

  private async applyThirtyEightTodayListingSchedulesUnsafe(
    today: string,
  ): Promise<number> {
    const rows = await this.ipoRepository
      .createQueryBuilder('ipo')
      .where('ipo.subscription_start_date <= :today', { today })
      .andWhere(
        'coalesce(ipo.subscription_end_date, ipo.subscription_start_date) >= :today',
        { today },
      )
      .andWhere('ipo.listing_date is null')
      .getMany();
    if (!rows.length) {
      return 0;
    }

    const todayDate = new Date(`${today}T12:00:00`);
    const listItems = await this.fetchThirtyEightIpoListItems(todayDate, todayDate);
    const byName = new Map(
      listItems.map((item) => [this.normalizeCorpName(item.corpName), item]),
    );

    let updated = 0;
    for (const row of rows) {
      const item = byName.get(this.normalizeCorpName(row.corpName));
      if (!item) {
        continue;
      }
      const listingDate = await this.fetchThirtyEightListingDate(item.detailUrl).catch(
        (error) => {
          this.logger.warn(
            `38 IPO detail request failed for ${row.corpName}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
          return null;
        },
      );
      if (!listingDate) {
        continue;
      }
      row.listingDate = listingDate;
      row.listingDateText = this.formatKoreanDateLabel(listingDate);
      row.raw = {
        ...(row.raw ?? {}),
        listingSource: '38_communications',
        thirtyEightCorpName: item.corpName,
      };
      await this.ipoRepository.save(row);
      updated += 1;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return updated;
  }

  private async fetchThirtyEightIpoListItems(
    fromDate: Date,
    toDate: Date,
  ): Promise<ThirtyEightIpoListItem[]> {
    const html = await this.fetchThirtyEightHtml('http://www.38.co.kr/html/fund/?o=k');
    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    const items: ThirtyEightIpoListItem[] = [];
    const from = this.formatDate(fromDate);
    const to = this.formatDate(toDate);
    for (const rowMatch of rows) {
      const row = rowMatch[1] ?? '';
      const linkMatch = /<a[^>]+href=["']([^"']*\/html\/fund\/\?o=v[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i.exec(
        row,
      );
      if (!linkMatch?.[1] || !linkMatch[2]) {
        continue;
      }
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
        this.cleanHtmlText(match[1] ?? ''),
      );
      const subscription = this.parseThirtyEightDateRange(cells[1] ?? '');
      if (!subscription.startDate) {
        continue;
      }
      const subscriptionEndDate = subscription.endDate ?? subscription.startDate;
      if (subscription.startDate > to || subscriptionEndDate < from) {
        continue;
      }
      items.push({
        corpName: this.cleanHtmlText(linkMatch[2]),
        detailUrl: this.absoluteThirtyEightUrl(linkMatch[1]),
        subscriptionStartDate: subscription.startDate,
        subscriptionEndDate,
      });
    }
    return items;
  }

  private async fetchThirtyEightListingDate(detailUrl: string): Promise<string | null> {
    const html = await this.fetchThirtyEightHtml(detailUrl);
    const listingLabel = '\uC0C1\uC7A5\uC77C';
    const pattern = new RegExp(
      `<td[^>]*>\\s*${listingLabel}\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`,
      'i',
    );
    const value = this.cleanHtmlText(pattern.exec(html)?.[1] ?? '');
    return this.parseThirtyEightDate(value);
  }

  private async fetchThirtyEightHtml(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    if (!response.ok) {
      throw new Error(`38 IPO request failed: ${response.status}`);
    }
    return new TextDecoder('euc-kr').decode(Buffer.from(await response.arrayBuffer()));
  }

  private cleanHtmlText(value: string): string {
    return value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#40;/g, '(')
      .replace(/&#41;/g, ')')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseThirtyEightDateRange(value: string): {
    startDate: string | null;
    endDate: string | null;
  } {
    const match = /(\d{4})\.(\d{2})\.(\d{2})(?:\s*~\s*(?:(\d{4})\.)?(\d{2})\.(\d{2}))?/.exec(
      value,
    );
    if (!match) {
      return { startDate: null, endDate: null };
    }
    const startDate = `${match[1]}-${match[2]}-${match[3]}`;
    const endDate = match[5]
      ? `${match[4] ?? match[1]}-${match[5]}-${match[6]}`
      : null;
    return { startDate, endDate };
  }

  private parseThirtyEightDate(value: string): string | null {
    const match = /(\d{4})\.(\d{2})\.(\d{2})/.exec(value);
    if (!match) {
      return null;
    }
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  private absoluteThirtyEightUrl(value: string): string {
    if (/^https?:\/\//i.test(value)) {
      return value.replace(/^https:\/\//i, 'http://');
    }
    return `http://www.38.co.kr${value.startsWith('/') ? '' : '/'}${value.replace(
      /&amp;/g,
      '&',
    )}`;
  }

  private async fetchKindListingSchedulesForMonth(month: {
    year: number;
    month: string;
  }): Promise<KindListingSchedule[]> {
    const entryUrl =
      'https://kind.krx.co.kr/listinvstg/pubofrschdl.do?method=searchPubofrScholMain';
    const cookieResponse = await fetch(entryUrl, {
      headers: this.kindHeaders(),
    });
    const cookie = cookieResponse.headers.get('set-cookie') ?? '';
    const response = await fetch('https://kind.krx.co.kr/listinvstg/pubofrschdl.do', {
      method: 'POST',
      headers: {
        ...this.kindHeaders(),
        Referer: entryUrl,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: new URLSearchParams({
        method: 'searchPubofrScholCalnd',
        forward: 'pubofrSchol_sub',
        marketType: '',
        scholType: '2',
        selYear: String(month.year),
        selMonth: month.month,
      }),
    });
    if (!response.ok) {
      throw new Error(`KIND listing schedule request failed: ${response.status}`);
    }
    const html = await response.text();
    if (/점검시간|img_notice|AKAMAI|boomerang/i.test(html)) {
      throw new Error('KIND returned maintenance or protection page.');
    }
    return this.parseKindListingScheduleHtml(html, month.year, month.month);
  }

  private parseKindListingScheduleHtml(
    html: string,
    year: number,
    month: string,
  ): KindListingSchedule[] {
    const normalized = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ');
    const items: KindListingSchedule[] = [];
    const tableCells = [...normalized.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    for (const cellMatch of tableCells) {
      const cell = cellMatch[1] ?? '';
      if (!/상장/.test(cell)) {
        continue;
      }
      const plain = cell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const day = /^(\d{1,2})(?:\s|$)/.exec(plain)?.[1]?.padStart(2, '0');
      if (!day) {
        continue;
      }
      const listingDate = `${year}-${month}-${day}`;
      const corpText = plain.replace(/^\d{1,2}\s*/, '').replace(/^상장\s*/, '');
      for (const corpName of this.splitKindCorpNames(corpText)) {
        items.push({
          corpName,
          listingDate,
          listingDateText: this.formatKoreanDateLabel(listingDate),
        });
      }
    }
    if (items.length) {
      return this.uniqueListingSchedules(items);
    }

    const dayBlocks = [
      ...normalized.matchAll(
        /(?:<td[^>]*>|<li[^>]*>|<div[^>]*>)([\s\S]{0,1800}?)(?=<td[^>]*>|<li[^>]*>|<div[^>]*>|$)/gi,
      ),
    ];
    for (const blockMatch of dayBlocks) {
      const block = blockMatch[1] ?? '';
      if (!/상장/.test(block)) {
        continue;
      }
      const day = this.extractKindCalendarDay(block);
      if (!day) {
        continue;
      }
      const listingDate = `${year}-${month}-${day}`;
      for (const corpName of this.extractKindCorpNames(block)) {
        items.push({
          corpName,
          listingDate,
          listingDateText: this.formatKoreanDateLabel(listingDate),
        });
      }
    }

    if (items.length) {
      return this.uniqueListingSchedules(items);
    }

    const plain = normalized.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const fallbackPattern =
      /(\d{1,2})\s*(?:일|\.)?\s*([가-힣A-Za-z0-9][가-힣A-Za-z0-9\s().·ㆍ&-]{1,60})\s*상장/g;
    for (const match of plain.matchAll(fallbackPattern)) {
      const day = match[1]?.padStart(2, '0');
      const corpName = this.cleanKindCorpName(match[2]);
      if (!day || !corpName) {
        continue;
      }
      const listingDate = `${year}-${month}-${day}`;
      items.push({
        corpName,
        listingDate,
        listingDateText: this.formatKoreanDateLabel(listingDate),
      });
    }
    return this.uniqueListingSchedules(items);
  }

  private extractKindCalendarDay(block: string): string | null {
    const text = block.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const match =
      /(?:^|\s)(\d{1,2})(?:\s*일)?(?:\s|$)/.exec(text) ??
      /day["']?\s*[:=]\s*["']?(\d{1,2})/i.exec(block);
    if (!match) {
      return null;
    }
    return match[1].padStart(2, '0');
  }

  private extractKindCorpNames(block: string): string[] {
    const names = new Set<string>();
    const linkPattern = /<a[^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of block.matchAll(linkPattern)) {
      const text = this.cleanKindCorpName(match[1]);
      if (text && !/상장|신고서|수요예측|청약|납입|IR/.test(text)) {
        names.add(text);
      }
    }
    if (!names.size) {
      const plain = block.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const match = /([가-힣A-Za-z0-9][가-힣A-Za-z0-9\s().·ㆍ&-]{1,60})\s*상장/.exec(
        plain,
      );
      const name = this.cleanKindCorpName(match?.[1]);
      if (name) {
        names.add(name);
      }
    }
    return [...names];
  }

  private cleanKindCorpName(value?: string): string {
    return (value ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\([^)]*상장[^)]*\)/g, ' ')
      .replace(/\b상장\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private splitKindCorpNames(value: string): string[] {
    return value
      .split(/\s{2,}|ㆍ|,|\n/)
      .map((item) => this.cleanKindCorpName(item))
      .filter((item) => !!item && !/신고서|수요예측|청약|납입|IR/.test(item));
  }

  private uniqueListingSchedules(
    schedules: KindListingSchedule[],
  ): KindListingSchedule[] {
    const byKey = new Map<string, KindListingSchedule>();
    for (const schedule of schedules) {
      byKey.set(
        `${this.normalizeCorpName(schedule.corpName)}:${schedule.listingDate}`,
        schedule,
      );
    }
    return [...byKey.values()];
  }

  private async applyListingSchedules(
    schedules: KindListingSchedule[],
    windowStart: string,
    windowEnd: string,
    source: string,
    onlyMissing: boolean,
  ): Promise<number> {
    if (!schedules.length) {
      return 0;
    }
    const rows = await this.ipoRepository.find({
      where: {
        subscriptionStartDate: Between(windowStart, windowEnd),
      },
    });
    const byName = new Map(rows.map((row) => [this.normalizeCorpName(row.corpName), row]));
    let updated = 0;
    for (const schedule of schedules) {
      const row = byName.get(this.normalizeCorpName(schedule.corpName));
      if (!row) {
        continue;
      }
      if (onlyMissing && row.listingDate) {
        continue;
      }
      row.listingDate = schedule.listingDate;
      row.listingDateText = schedule.listingDateText;
      row.raw = {
        ...(row.raw ?? {}),
        listingSource: source,
        listingCorpName: schedule.corpName,
      };
      await this.ipoRepository.save(row);
      updated += 1;
    }
    return updated;
  }

  private monthKeysBetween(
    fromDate: Date,
    toDate: Date,
  ): Array<{ year: number; month: string }> {
    const result: Array<{ year: number; month: string }> = [];
    const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    const end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
    while (cursor <= end) {
      result.push({
        year: cursor.getFullYear(),
        month: String(cursor.getMonth() + 1).padStart(2, '0'),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
  }

  private kindHeaders(): HeadersInit {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      Accept: 'text/html, */*; q=0.01',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    };
  }

  private normalizeCorpName(value: string): string {
    return value
      .replace(/\s+/g, '')
      .replace(/주식회사|㈜|\(주\)|스팩|기업인수목적/g, '')
      .toLowerCase();
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
