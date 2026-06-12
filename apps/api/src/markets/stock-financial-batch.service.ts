import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StockFinancialEntity } from './stock-financial.entity';
import { StockMasterEntity } from './stock-master.entity';

type DartFinancialRow = {
  account_nm?: string;
  thstrm_amount?: string;
};

type DartFinancialResponse = {
  status?: string;
  message?: string;
  list?: DartFinancialRow[];
};

type DartStockQuantityResponse = {
  status?: string;
  message?: string;
  list?: Array<{
    se?: string;
    istc_totqy?: string;
    distb_stock_co?: string;
  }>;
};

type KisTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type KisPriceResponse = {
  output?: Record<string, string | undefined>;
};

@Injectable()
export class StockFinancialBatchService {
  private readonly logger = new Logger(StockFinancialBatchService.name);
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
      this.logger.warn('DART financial batch skipped: DART_API_KEY is missing.');
      return { stocks: 0, rows: 0, failed: 0 };
    }

    const stocks = await this.masterRepository.find({
      where: {
        active: true,
        market: In(['KR:KOSPI', 'KR:KOSDAQ']),
      },
      order: { symbol: 'ASC' },
    });
    const rows = stocks
      .filter((stock) => !!stock.dartCorpCode)
      .slice(0, limit && limit > 0 ? limit : undefined);
    const years = this.getRecentFiscalYears(5);
    let savedRows = 0;
    let failed = 0;

    for (const stock of rows) {
      try {
        const currentPrice = await this.getKisCurrentPrice(stock).catch(() => null);
        const financials = await this.fetchStockFinancials(
          apiKey,
          stock,
          years,
          currentPrice,
        );
        for (const item of financials) {
          await this.financialRepository.upsert(item, ['id']);
          savedRows += 1;
        }
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `DART financial refresh failed for ${stock.symbol}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
      await this.sleep(120);
    }

    return { stocks: rows.length, rows: savedRows, failed };
  }

  private async fetchStockFinancials(
    apiKey: string,
    stock: StockMasterEntity,
    years: number[],
    currentPrice: number | null,
  ): Promise<Partial<StockFinancialEntity>[]> {
    const items: Partial<StockFinancialEntity>[] = [];
    const latestYear = years[0];

    for (const fiscalYear of years) {
      const [financial, shares] = await Promise.all([
        this.fetchDartFinancial(apiKey, stock.dartCorpCode!, fiscalYear),
        this.fetchDartListedShares(apiKey, stock.dartCorpCode!, fiscalYear).catch(
          () => null,
        ),
      ]);
      if (!financial) {
        continue;
      }

      const isLatestYear = fiscalYear === latestYear;
      const marketCap = isLatestYear && currentPrice && shares ? currentPrice * shares : null;
      items.push({
        id: `${stock.symbol}:${fiscalYear}`,
        symbol: stock.symbol,
        corpCode: stock.dartCorpCode,
        fiscalYear,
        revenue: financial.revenue,
        operatingProfit: financial.operatingProfit,
        netIncome: financial.netIncome,
        equity: financial.equity,
        assets: financial.assets,
        eps: financial.eps,
        listedShares: shares,
        closePrice: isLatestYear ? currentPrice : null,
        marketCap,
        per: isLatestYear ? this.safeDivide(currentPrice, financial.eps) : null,
        pbr: isLatestYear ? this.safeDivide(marketCap, financial.equity) : null,
        psr: isLatestYear ? this.safeDivide(marketCap, financial.revenue) : null,
        roe:
          isLatestYear &&
          financial.netIncome !== null &&
          financial.equity &&
          financial.equity > 0
            ? (financial.netIncome / financial.equity) * 100
            : null,
        reportCode: '11011',
        source: 'dart_financial_batch',
        fetchedAt: new Date(),
      });
      await this.sleep(60);
    }

    return items;
  }

  private async fetchDartFinancial(
    apiKey: string,
    corpCode: string,
    fiscalYear: number,
  ): Promise<{
    revenue: number | null;
    operatingProfit: number | null;
    netIncome: number | null;
    equity: number | null;
    assets: number | null;
    eps: number | null;
  } | null> {
    const url = new URL('https://opendart.fss.or.kr/api/fnlttSinglAcnt.json');
    url.searchParams.set('crtfc_key', apiKey);
    url.searchParams.set('corp_code', corpCode);
    url.searchParams.set('bsns_year', String(fiscalYear));
    url.searchParams.set('reprt_code', '11011');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`DART financial request failed: ${response.status}`);
    }
    const body = (await response.json()) as DartFinancialResponse;
    if (body.status !== '000' || !body.list?.length) {
      return null;
    }

    return {
      revenue: this.pickAccount(body.list, ['매출액', '영업수익']),
      operatingProfit: this.pickAccount(body.list, ['영업이익']),
      netIncome: this.pickAccount(body.list, [
        '당기순이익(손실)',
        '당기순이익',
      ]),
      equity: this.pickAccount(body.list, ['자본총계']),
      assets: this.pickAccount(body.list, ['자산총계']),
      eps: this.pickAccount(body.list, [
        '기본주당이익(손실)',
        '기본주당이익',
        '희석주당이익(손실)',
      ]),
    };
  }

  private async fetchDartListedShares(
    apiKey: string,
    corpCode: string,
    fiscalYear: number,
  ): Promise<number | null> {
    const url = new URL('https://opendart.fss.or.kr/api/stockTotqySttus.json');
    url.searchParams.set('crtfc_key', apiKey);
    url.searchParams.set('corp_code', corpCode);
    url.searchParams.set('bsns_year', String(fiscalYear));
    url.searchParams.set('reprt_code', '11011');

    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as DartStockQuantityResponse;
    if (body.status !== '000' || !body.list?.length) {
      return null;
    }

    const normal = body.list.find((item) => item.se === '보통주');
    const total = body.list.find((item) => item.se === '합계');
    return this.toNumber(normal?.istc_totqy ?? normal?.distb_stock_co) ??
      this.toNumber(total?.istc_totqy ?? total?.distb_stock_co);
  }

  private pickAccount(rows: DartFinancialRow[], names: string[]): number | null {
    for (const name of names) {
      const row = rows.find((item) => item.account_nm === name);
      const value = this.toNumber(row?.thstrm_amount);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }

  private getRecentFiscalYears(count: number): number[] {
    const latest = new Date().getFullYear() - 1;
    return Array.from({ length: count }, (_, index) => latest - index);
  }

  private async getKisCurrentPrice(stock: StockMasterEntity): Promise<number | null> {
    const response = await this.kisGet('/uapi/domestic-stock/v1/quotations/inquire-price', {
      FID_COND_MRKT_DIV_CODE: stock.market === 'KR:KOSDAQ' ? 'Q' : 'J',
      FID_INPUT_ISCD: stock.symbol,
    });
    return this.toNumber(response.output?.stck_prpr ?? response.output?.prdy_clpr);
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
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

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
    if (value === null || value === undefined || value === '-' || value === '') {
      return null;
    }
    const parsed =
      typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
