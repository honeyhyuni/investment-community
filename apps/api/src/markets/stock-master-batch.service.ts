import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { inflateRawSync } from 'node:zlib';
import { In, LessThan, Repository } from 'typeorm';
import { StockMasterEntity } from './stock-master.entity';
import { StockProfileEntity } from './stock-profile.entity';

type MasterInput = Pick<
  StockMasterEntity,
  | 'id'
  | 'symbol'
  | 'name'
  | 'market'
  | 'exchange'
  | 'currency'
  | 'country'
  | 'type'
  | 'standardCode'
  | 'dartCorpCode'
  | 'source'
>;

@Injectable()
export class StockMasterBatchService {
  private readonly logger = new Logger(StockMasterBatchService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(StockMasterEntity)
    private readonly masterRepository: Repository<StockMasterEntity>,
    @InjectRepository(StockProfileEntity)
    private readonly profileRepository: Repository<StockProfileEntity>,
  ) {}

  @Cron('0 0 1 * * *', { timeZone: 'Asia/Seoul' })
  async refreshDailyStockMaster(): Promise<void> {
    const result = await this.refreshAll();
    this.logger.log(
      `Daily stock master batch completed: KR=${result.kr}, US=${result.us}, DART=${result.dart}.`,
    );
  }

  async refreshAll(): Promise<{ kr: number; us: number; dart: number }> {
    const [kr, us] = await Promise.all([
      this.runBatchPart('Korean stock master', () => this.refreshKoreanMaster()),
      this.runBatchPart('US stock master', () => this.refreshUsMaster()),
    ]);
    const dart = await this.runBatchPart('DART company profile', () =>
      this.refreshDartProfiles(),
    );
    return { kr, us, dart };
  }

  private async refreshKoreanMaster(): Promise<number> {
    const [kospi, kosdaq, dartCodes] = await Promise.all([
      this.downloadKisMaster(
        'https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip',
        'KR:KOSPI',
        'KOSPI',
        228,
      ),
      this.downloadKisMaster(
        'https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip',
        'KR:KOSDAQ',
        'KOSDAQ',
        222,
      ),
      this.downloadDartCorpCodes().catch(() => new Map<string, string>()),
    ]);
    const rows = [...kospi, ...kosdaq].map((row) => ({
      ...row,
      dartCorpCode: dartCodes.get(row.symbol) ?? null,
    }));
    if (rows.length < 1_000) {
      throw new Error(
        `KIS stock master returned an unsafe row count: ${rows.length}`,
      );
    }
    await this.replaceMarketRows(['KR:KOSPI', 'KR:KOSDAQ'], rows);
    return rows.length;
  }

  private async refreshUsMaster(): Promise<number> {
    const apiKey = this.configService.get<string>('FINNHUB_API_KEY');
    if (!apiKey) {
      this.logger.warn('US stock master batch skipped: FINNHUB_API_KEY is missing.');
      return 0;
    }

    const url = new URL('https://finnhub.io/api/v1/stock/symbol');
    url.searchParams.set('exchange', 'US');
    url.searchParams.set('token', apiKey);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Finnhub stock master request failed: ${response.status}`);
    }

    const body = (await response.json()) as Array<{
      symbol?: string;
      displaySymbol?: string;
      description?: string;
      type?: string;
      currency?: string;
      mic?: string;
    }>;
    const majorMics = new Set(['XNAS', 'XNYS', 'ARCX', 'BATS']);
    const supportedTypes = new Set([
      'ADR',
      'Common Stock',
      'Depositary Receipt',
      'ETF',
      'ETP',
    ]);
    const rows: MasterInput[] = body
      .filter(
        (item) =>
          !!item.symbol &&
          !!item.description &&
          item.currency === 'USD' &&
          supportedTypes.has(item.type ?? '') &&
          majorMics.has(item.mic ?? ''),
      )
      .map((item) => ({
        id: `US:${item.symbol}`,
        symbol: item.symbol!,
        name: item.description!,
        market: 'US',
        exchange: item.mic ?? 'US',
        currency: 'USD',
        country: 'US',
        type: item.type ?? null,
        standardCode: item.displaySymbol ?? null,
        dartCorpCode: null,
        source: 'finnhub_stock_symbol_batch',
      }));

    if (rows.length < 1_000) {
      throw new Error(
        `Finnhub stock master returned an unsafe row count: ${rows.length}`,
      );
    }
    await this.replaceMarketRows(['US'], rows);
    return rows.length;
  }

  private async downloadKisMaster(
    url: string,
    market: string,
    exchange: string,
    tailSize: number,
  ): Promise<MasterInput[]> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`KIS stock master request failed: ${response.status}`);
    }

    const file = this.extractFirstZipEntry(Buffer.from(await response.arrayBuffer()));
    return file
      .toString('binary')
      .split(/\r?\n/)
      .map((binaryLine) => Buffer.from(binaryLine, 'binary'))
      .filter((line) => line.length > 21 + tailSize)
      .map((line) => {
        const symbol = line.subarray(0, 9).toString('ascii').trim();
        const standardCode = line.subarray(9, 21).toString('ascii').trim();
        const name = new TextDecoder('euc-kr')
          .decode(line.subarray(21, line.length - tailSize))
          .trim();
        return {
          id: `${market}:${symbol}`,
          symbol,
          name,
          market,
          exchange,
          currency: 'KRW',
          country: 'KR',
          type: 'Common Stock',
          standardCode,
          dartCorpCode: null,
          source: 'kis_official_stock_master_batch',
        };
      })
      .filter((row) => /^\d{6}$/.test(row.symbol) && !!row.name);
  }

  private async downloadDartCorpCodes(): Promise<Map<string, string>> {
    const apiKey = this.configService.get<string>('DART_API_KEY');
    if (!apiKey) {
      return new Map();
    }

    const url = new URL('https://opendart.fss.or.kr/api/corpCode.xml');
    url.searchParams.set('crtfc_key', apiKey);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`DART corp code request failed: ${response.status}`);
    }

    const xml = this.extractFirstZipEntry(
      Buffer.from(await response.arrayBuffer()),
    ).toString('utf8');
    const result = new Map<string, string>();
    const pattern =
      /<corp_code>([^<]+)<\/corp_code>[\s\S]*?<stock_code>([^<]*)<\/stock_code>/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(xml)) !== null) {
      const stockCode = match[2].trim();
      if (/^\d{6}$/.test(stockCode)) {
        result.set(stockCode, match[1].trim());
      }
    }
    return result;
  }

  private async refreshDartProfiles(): Promise<number> {
    const apiKey = this.configService.get<string>('DART_API_KEY');
    if (!apiKey) {
      this.logger.warn('DART profile batch skipped: DART_API_KEY is missing.');
      return 0;
    }

    const rows = await this.masterRepository.find({
      where: {
        active: true,
        market: In(['KR:KOSPI', 'KR:KOSDAQ']),
      },
    });
    let updated = 0;
    for (const batch of this.chunk(
      rows.filter((row) => !!row.dartCorpCode),
      5,
    )) {
      await Promise.all(
        batch.map(async (row) => {
          const profile = await this.fetchDartCompany(apiKey, row.dartCorpCode!);
          if (!profile) {
            return;
          }

          await this.profileRepository.save({
            symbol: row.symbol,
            name: profile.corp_name ?? row.name,
            exchange: row.exchange,
            currency: 'KRW',
            country: '대한민국',
            ipo: this.formatDartDate(profile.est_dt),
            industry: '국내주식',
            website: profile.hm_url || null,
            logo: null,
            marketCapitalization: null,
            shareOutstanding: null,
            overviewEn: `${profile.corp_name ?? row.name} is a Korean listed corporation. This profile is stored from DART company profile data.`,
            overviewKo: `${profile.corp_name ?? row.name}은(는) ${row.exchange} 상장 법인입니다. 대표자는 ${profile.ceo_nm || '미공시'}이며, 설립일은 ${this.formatDartDate(profile.est_dt) || '미공시'}입니다. 소재지는 ${profile.adres || '미공시'}입니다.`,
            source: 'dart_company_batch',
            fetchedAt: new Date(),
          });
          updated += 1;
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return updated;
  }

  private async fetchDartCompany(
    apiKey: string,
    corpCode: string,
  ): Promise<{
    corp_name?: string;
    ceo_nm?: string;
    adres?: string;
    hm_url?: string;
    est_dt?: string;
  } | null> {
    const url = new URL('https://opendart.fss.or.kr/api/company.json');
    url.searchParams.set('crtfc_key', apiKey);
    url.searchParams.set('corp_code', corpCode);
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as {
      status?: string;
      corp_name?: string;
      ceo_nm?: string;
      adres?: string;
      hm_url?: string;
      est_dt?: string;
    };
    return body.status === '000' ? body : null;
  }

  private async replaceMarketRows(
    markets: string[],
    rows: MasterInput[],
  ): Promise<void> {
    const startedAt = new Date();
    for (const batch of this.chunk(rows, 500)) {
      await this.masterRepository.upsert(
        batch.map((row) => ({
          ...row,
          active: true,
          lastSeenAt: startedAt,
        })),
        ['id'],
      );
    }
    await this.masterRepository.update(
      { market: In(markets), lastSeenAt: LessThan(startedAt) },
      { active: false },
    );
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
    if (zip.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error('ZIP central directory not found.');
    }
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

  private formatDartDate(value?: string): string | null {
    if (!value || !/^\d{8}$/.test(value)) {
      return null;
    }
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      result.push(items.slice(index, index + size));
    }
    return result;
  }

  private async runBatchPart(
    name: string,
    task: () => Promise<number>,
  ): Promise<number> {
    try {
      return await task();
    } catch (error) {
      this.logger.error(
        `${name} batch failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return 0;
    }
  }
}
