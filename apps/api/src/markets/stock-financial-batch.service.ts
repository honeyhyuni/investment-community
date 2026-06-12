import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StockFinancialEntity } from './stock-financial.entity';
import { StockMasterEntity } from './stock-master.entity';

type DartFinancialRow = {
  corp_code?: string;
  fs_div?: string;
  account_nm?: string;
  thstrm_amount?: string;
};

type DartFinancialResponse = {
  status?: string;
  message?: string;
  list?: DartFinancialRow[];
};

type ParsedFinancial = {
  revenue: number | null;
  operatingProfit: number | null;
  netIncome: number | null;
  equity: number | null;
  assets: number | null;
};

type KisTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type KisPriceResponse = {
  output?: Record<string, string | undefined>;
};

type KisPrice = {
  currentPrice: number | null;
  marketCap: number | null;
};

@Injectable()
export class StockFinancialBatchService {
  private readonly logger = new Logger(StockFinancialBatchService.name);
  private readonly dartChunkSize = 100;
  private kisTokenCache: { token: string; expiresAt: number } | null = null;
  private lastKisRequestAt = 0;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(StockMasterEntity)
    private readonly masterRepository: Repository<StockMasterEntity>,
    @InjectRepository(StockFinancialEntity)
    private readonly financialRepository: Repository<StockFinancialEntity>,
  ) {}

  @Cron('0 0 0 * * *', { timeZone: 'Asia/Seoul' })
  async refreshDailyFinancials(): Promise<void> {
    const result = await this.refreshRecentFinancials();
    this.logger.log(
      `Daily Korean financial batch completed: stocks=${result.stocks}, rows=${result.rows}, failed=${result.failed}.`,
    );
  }

  async refreshRecentFinancials(limit?: number): Promise<{
    stocks: number;
    rows: number;
    failed: number;
  }> {
    const apiKey = this.configService.get<string>('DART_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'DART financial batch skipped: DART_API_KEY is missing.',
      );
      return { stocks: 0, rows: 0, failed: 0 };
    }

    const stocks = (
      await this.masterRepository.find({
        where: {
          active: true,
          market: In(['KR:KOSPI', 'KR:KOSDAQ']),
        },
        order: { symbol: 'ASC' },
      })
    )
      .filter((stock) => !!stock.dartCorpCode)
      .slice(0, limit && limit > 0 ? limit : undefined);

    if (!stocks.length) {
      return { stocks: 0, rows: 0, failed: 0 };
    }

    const years = this.getRecentFiscalYears(5);
    if (!(await this.isDartFinancialApiAvailable(apiKey, years[0]))) {
      this.logger.warn(
        'DART financial batch skipped: DART multi-company API is unavailable from this server.',
      );
      return { stocks: 0, rows: 0, failed: 0 };
    }

    const stockByCorpCode = new Map(
      stocks.map((stock) => [stock.dartCorpCode!, stock]),
    );
    const financialByKey = new Map<string, ParsedFinancial>();
    const failedCorpCodes = new Set<string>();
    const corpCodeChunks = this.chunk(
      [...stockByCorpCode.keys()],
      this.dartChunkSize,
    );

    for (const fiscalYear of years) {
      for (const corpCodes of corpCodeChunks) {
        try {
          const rows = await this.fetchDartFinancialsBulk(
            apiKey,
            corpCodes,
            fiscalYear,
          );
          this.parseFinancialRows(rows).forEach((financial, corpCode) => {
            financialByKey.set(`${corpCode}:${fiscalYear}`, financial);
          });
        } catch (error) {
          corpCodes.forEach((corpCode) => failedCorpCodes.add(corpCode));
          this.logger.warn(
            `DART bulk financial refresh failed for ${corpCodes.length} companies in ${fiscalYear}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        }
        await this.sleep(1_000);
      }
    }

    const entities: Partial<StockFinancialEntity>[] = [];
    for (const stock of stocks) {
      const available = years
        .map((fiscalYear) => ({
          fiscalYear,
          financial: financialByKey.get(`${stock.dartCorpCode}:${fiscalYear}`),
        }))
        .filter(
          (item): item is { fiscalYear: number; financial: ParsedFinancial } =>
            !!item.financial,
        );
      if (!available.length) {
        continue;
      }

      const latestAvailableYear = available[0].fiscalYear;
      const quote = await this.getKisCurrentPrice(stock).catch(() => ({
        currentPrice: null,
        marketCap: null,
      }));
      for (const { fiscalYear, financial } of available) {
        const isLatestYear = fiscalYear === latestAvailableYear;
        const marketCap = isLatestYear ? quote.marketCap : null;
        entities.push({
          id: `${stock.symbol}:${fiscalYear}`,
          symbol: stock.symbol,
          corpCode: stock.dartCorpCode,
          fiscalYear,
          revenue: financial.revenue,
          operatingProfit: financial.operatingProfit,
          netIncome: financial.netIncome,
          equity: financial.equity,
          assets: financial.assets,
          eps: null,
          listedShares: null,
          closePrice: isLatestYear ? quote.currentPrice : null,
          marketCap,
          per: isLatestYear
            ? this.safeDivide(marketCap, financial.netIncome)
            : null,
          pbr: isLatestYear
            ? this.safeDivide(marketCap, financial.equity)
            : null,
          psr: isLatestYear
            ? this.safeDivide(marketCap, financial.revenue)
            : null,
          roe:
            isLatestYear &&
            financial.netIncome !== null &&
            financial.equity !== null &&
            financial.equity > 0
              ? (financial.netIncome / financial.equity) * 100
              : null,
          reportCode: '11011',
          source: 'dart_multi_financial_batch',
          fetchedAt: new Date(),
        });
      }
    }

    for (const items of this.chunk(entities, 500)) {
      await this.financialRepository.upsert(items, ['id']);
    }

    return {
      stocks: stocks.length,
      rows: entities.length,
      failed: failedCorpCodes.size,
    };
  }

  private async isDartFinancialApiAvailable(
    apiKey: string,
    fiscalYear: number,
  ): Promise<boolean> {
    try {
      const rows = await this.fetchDartFinancialsBulk(
        apiKey,
        ['00126380'],
        fiscalYear,
      );
      this.logger.debug(
        `DART multi-company financial API preflight succeeded with ${rows.length} rows.`,
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `DART multi-company financial API preflight failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return false;
    }
  }

  private async fetchDartFinancialsBulk(
    apiKey: string,
    corpCodes: string[],
    fiscalYear: number,
  ): Promise<DartFinancialRow[]> {
    const url = new URL('https://opendart.fss.or.kr/api/fnlttMultiAcnt.json');
    url.searchParams.set('crtfc_key', apiKey);
    url.searchParams.set('corp_code', corpCodes.join(','));
    url.searchParams.set('bsns_year', String(fiscalYear));
    url.searchParams.set('reprt_code', '11011');

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          throw new Error(`DART financial request failed: ${response.status}`);
        }

        const body = (await response.json()) as DartFinancialResponse;
        if (body.status === '000') {
          return body.list ?? [];
        }
        if (body.status === '013') {
          return [];
        }
        throw new Error(
          `DART financial response failed: ${body.status ?? 'unknown'} ${
            body.message ?? ''
          }`.trim(),
        );
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error('Unknown DART request error');
        if (attempt < 3) {
          await this.sleep(attempt * 5_000);
        }
      }
    }

    throw lastError ?? new Error('DART financial request failed.');
  }

  private parseFinancialRows(
    rows: DartFinancialRow[],
  ): Map<string, ParsedFinancial> {
    const grouped = new Map<string, DartFinancialRow[]>();
    for (const row of rows) {
      if (!row.corp_code) {
        continue;
      }
      const current = grouped.get(row.corp_code) ?? [];
      current.push(row);
      grouped.set(row.corp_code, current);
    }

    const parsed = new Map<string, ParsedFinancial>();
    grouped.forEach((companyRows, corpCode) => {
      const financial = {
        revenue: this.pickAccount(companyRows, [
          '\uB9E4\uCD9C\uC561',
          '\uC601\uC5C5\uC218\uC775',
          '\uC218\uC775(\uB9E4\uCD9C\uC561)',
        ]),
        operatingProfit: this.pickAccount(companyRows, [
          '\uC601\uC5C5\uC774\uC775',
          '\uC601\uC5C5\uC774\uC775(\uC190\uC2E4)',
        ]),
        netIncome: this.pickAccount(companyRows, [
          '\uB2F9\uAE30\uC21C\uC774\uC775',
          '\uB2F9\uAE30\uC21C\uC774\uC775(\uC190\uC2E4)',
          '\uC5F0\uACB0\uB2F9\uAE30\uC21C\uC774\uC775',
        ]),
        equity: this.pickAccount(companyRows, ['\uC790\uBCF8\uCD1D\uACC4']),
        assets: this.pickAccount(companyRows, ['\uC790\uC0B0\uCD1D\uACC4']),
      };
      if (Object.values(financial).some((value) => value !== null)) {
        parsed.set(corpCode, financial);
      }
    });
    return parsed;
  }

  private pickAccount(
    rows: DartFinancialRow[],
    names: string[],
  ): number | null {
    for (const fsDiv of ['CFS', 'OFS']) {
      for (const name of names) {
        const row = rows.find(
          (item) => item.fs_div === fsDiv && item.account_nm === name,
        );
        const value = this.toNumber(row?.thstrm_amount);
        if (value !== null) {
          return value;
        }
      }
    }
    return null;
  }

  private getRecentFiscalYears(count: number): number[] {
    const latest = new Date().getFullYear() - 1;
    return Array.from({ length: count }, (_, index) => latest - index);
  }

  private async getKisCurrentPrice(
    stock: StockMasterEntity,
  ): Promise<KisPrice> {
    const response = await this.kisGet(
      '/uapi/domestic-stock/v1/quotations/inquire-price',
      {
        FID_COND_MRKT_DIV_CODE: stock.market === 'KR:KOSDAQ' ? 'Q' : 'J',
        FID_INPUT_ISCD: stock.symbol,
      },
    );
    const currentPrice = this.toNumber(
      response.output?.stck_prpr ?? response.output?.prdy_clpr,
    );
    const marketCapInHundredMillionWon = this.toNumber(
      response.output?.hts_avls,
    );
    return {
      currentPrice,
      marketCap:
        marketCapInHundredMillionWon !== null &&
        marketCapInHundredMillionWon > 0
          ? marketCapInHundredMillionWon * 100_000_000
          : null,
    };
  }

  private async kisGet(
    path: string,
    params: Record<string, string>,
  ): Promise<KisPriceResponse> {
    const appKey = this.configService.get<string>('KIS_APP_KEY');
    const appSecret = this.configService.get<string>('KIS_APP_SECRET');
    if (!appKey || !appSecret) {
      throw new Error('KIS API key is not configured.');
    }

    await this.waitKisRequestSlot();
    const token = await this.getKisAccessToken(appKey, appSecret);
    const baseUrl =
      this.configService.get<string>('KIS_BASE_URL')?.trim() ||
      'https://openapi.koreainvestment.com:9443';
    const url = new URL(`${baseUrl}${path}`);
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );

    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: 'FHKST01010100',
        custtype: 'P',
      },
    });
    if (!response.ok) {
      throw new Error(`KIS price request failed: ${response.status}`);
    }
    return response.json() as Promise<KisPriceResponse>;
  }

  private async getKisAccessToken(
    appKey: string,
    appSecret: string,
  ): Promise<string> {
    const now = Date.now();
    if (this.kisTokenCache && this.kisTokenCache.expiresAt - 60_000 > now) {
      return this.kisTokenCache.token;
    }

    const baseUrl =
      this.configService.get<string>('KIS_BASE_URL')?.trim() ||
      'https://openapi.koreainvestment.com:9443';
    const response = await fetch(`${baseUrl}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: appKey,
        appsecret: appSecret,
      }),
    });
    if (!response.ok) {
      throw new Error(`KIS token request failed: ${response.status}`);
    }

    const body = (await response.json()) as KisTokenResponse;
    if (!body.access_token) {
      throw new Error('KIS token response is invalid.');
    }
    this.kisTokenCache = {
      token: body.access_token,
      expiresAt: now + (body.expires_in ?? 86400) * 1000,
    };
    return body.access_token;
  }

  private async waitKisRequestSlot(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, 120 - (now - this.lastKisRequestAt));
    if (wait > 0) {
      await this.sleep(wait);
    }
    this.lastKisRequestAt = Date.now();
  }

  private safeDivide(
    numerator: number | null | undefined,
    denominator: number | null | undefined,
  ): number | null {
    if (
      numerator === null ||
      numerator === undefined ||
      denominator === null ||
      denominator === undefined ||
      !Number.isFinite(numerator) ||
      !Number.isFinite(denominator) ||
      denominator === 0
    ) {
      return null;
    }
    return numerator / denominator;
  }

  private toNumber(value: string | number | null | undefined): number | null {
    if (
      value === null ||
      value === undefined ||
      value === '-' ||
      value === ''
    ) {
      return null;
    }
    const parsed =
      typeof value === 'number'
        ? value
        : Number(String(value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
