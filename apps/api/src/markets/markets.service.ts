import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import Redis from 'ioredis';
import {
  CandlePoint,
  ChartPeriod,
  CompanyProfile,
  CompanyMetrics,
  FinnhubQuote,
  MarketQuote,
  StockDetail,
  StockSymbol,
  MarketNews,
} from './finnhub-quote.dto';
import { StockProfileEntity } from './stock-profile.entity';
import { StockMasterEntity } from './stock-master.entity';

const MARKET_PULSE = [
  { symbol: 'QQQ', name: 'Nasdaq 100 proxy' },
  { symbol: 'SPY', name: 'S&P 500 proxy' },
  { symbol: 'DIA', name: 'Dow Jones proxy' },
  { symbol: 'GLD', name: 'Gold proxy' },
  { symbol: 'USO', name: 'WTI Oil proxy' },
  { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin' },
  { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum' },
];

const KR_INDEX_PULSE = [
  { symbol: 'KIS_INDEX:0001', name: 'KOSPI', code: '0001', marketClass: 'K', naverCode: 'KOSPI' },
  { symbol: 'KIS_INDEX:1001', name: 'KOSDAQ', code: '1001', marketClass: 'Q', naverCode: 'KOSDAQ' },
];

const DEFAULT_US_STOCKS = [
  'QQQ',
  'SPY',
  'DIA',
  'GLD',
  'USO',
  'AAPL',
  'MSFT',
  'NVDA',
  'AMZN',
  'GOOGL',
  'META',
  'TSLA',
  'AVGO',
  'AMD',
  'NFLX',
  'COST',
  'JPM',
];

const DEFAULT_KR_STOCKS = [
  { symbol: '005930', name: '삼성전자', marketDiv: 'J' },
  { symbol: '000660', name: 'SK하이닉스', marketDiv: 'J' },
  { symbol: '373220', name: 'LG에너지솔루션', marketDiv: 'J' },
  { symbol: '207940', name: '삼성바이오로직스', marketDiv: 'J' },
  { symbol: '005380', name: '현대차', marketDiv: 'J' },
  { symbol: '000270', name: '기아', marketDiv: 'J' },
  { symbol: '035420', name: 'NAVER', marketDiv: 'J' },
  { symbol: '068270', name: '셀트리온', marketDiv: 'J' },
  { symbol: '051910', name: 'LG화학', marketDiv: 'J' },
  { symbol: '096770', name: 'SK이노베이션', marketDiv: 'J' },
  { symbol: '005490', name: 'POSCO홀딩스', marketDiv: 'J' },
  { symbol: '105560', name: 'KB금융', marketDiv: 'J' },
  { symbol: '055550', name: '신한지주', marketDiv: 'J' },
  { symbol: '035720', name: '카카오', marketDiv: 'J' },
  { symbol: '036570', name: '엔씨소프트', marketDiv: 'J' },
  { symbol: '066570', name: 'LG전자', marketDiv: 'J' },
  { symbol: '323410', name: '카카오뱅크', marketDiv: 'J' },
  { symbol: '251270', name: '넷마블', marketDiv: 'J' },
  { symbol: '259960', name: '크래프톤', marketDiv: 'J' },
  { symbol: '122630', name: 'KODEX 레버리지', marketDiv: 'J' },
].map((stock) => ({ ...stock, marketDiv: stock.marketDiv as KisMarketDiv }));

const DEFAULT_KR_STOCKS_CLEAN = [
  { symbol: '005930', name: '삼성전자', marketDiv: 'J' },
  { symbol: '000660', name: 'SK하이닉스', marketDiv: 'J' },
  { symbol: '373220', name: 'LG에너지솔루션', marketDiv: 'J' },
  { symbol: '207940', name: '삼성바이오로직스', marketDiv: 'J' },
  { symbol: '005380', name: '현대차', marketDiv: 'J' },
  { symbol: '000270', name: '기아', marketDiv: 'J' },
  { symbol: '035420', name: 'NAVER', marketDiv: 'J' },
  { symbol: '068270', name: '셀트리온', marketDiv: 'J' },
  { symbol: '051910', name: 'LG화학', marketDiv: 'J' },
  { symbol: '096770', name: 'SK이노베이션', marketDiv: 'J' },
  { symbol: '005490', name: 'POSCO홀딩스', marketDiv: 'J' },
  { symbol: '105560', name: 'KB금융', marketDiv: 'J' },
  { symbol: '055550', name: '신한지주', marketDiv: 'J' },
  { symbol: '035720', name: '카카오', marketDiv: 'J' },
  { symbol: '036570', name: '엔씨소프트', marketDiv: 'J' },
  { symbol: '066570', name: 'LG전자', marketDiv: 'J' },
  { symbol: '323410', name: '카카오뱅크', marketDiv: 'J' },
  { symbol: '251270', name: '넷마블', marketDiv: 'J' },
  { symbol: '259960', name: '크래프톤', marketDiv: 'J' },
  { symbol: '122630', name: 'KODEX 레버리지', marketDiv: 'J' },
].map((stock) => ({ ...stock, marketDiv: stock.marketDiv as KisMarketDiv }));

const DART_CORP_CODES: Record<string, string> = {
  '005930': '00126380',
  '000660': '00164779',
  '207940': '00877059',
  '005380': '00164742',
  '000270': '00106641',
  '035420': '00266961',
};

type KisMarketDiv = 'J' | 'Q';

type KisStock = {
  symbol: string;
  name: string;
  marketDiv: KisMarketDiv;
};

type KisTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

type KisPriceResponse = {
  output?: Record<string, string | undefined>;
  output1?: Record<string, string | undefined>;
  rt_cd?: string;
  msg1?: string;
  msg_cd?: string;
};

type KisDailyCandleResponse = {
  output1?: Record<string, string | undefined>;
  output2?: Array<Record<string, string | undefined>>;
  rt_cd?: string;
  msg1?: string;
  msg_cd?: string;
};

type KisListResponse = {
  output?: Array<Record<string, string | undefined>>;
  output1?: Array<Record<string, string | undefined>>;
  rt_cd?: string;
  msg1?: string;
  msg_cd?: string;
};

type KisIndexChartPriceResponse = {
  output1?: Record<string, string | undefined>;
  output2?: Array<Record<string, string | undefined>>;
  rt_cd?: string;
  msg1?: string;
  msg_cd?: string;
};

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);
  private readonly finnhubBaseUrl = 'https://finnhub.io/api/v1';
  private kisTokenCache: { token: string; expiresAt: number } | null = null;
  private kisTokenPromise: Promise<string> | null = null;
  private kisRequestQueue: Promise<void> = Promise.resolve();
  private lastKisRequestAt = 0;
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(StockProfileEntity)
    private readonly stockProfilesRepository: Repository<StockProfileEntity>,
    @InjectRepository(StockMasterEntity)
    private readonly stockMasterRepository: Repository<StockMasterEntity>,
  ) {
    this.redis = new Redis(
      this.configService.get<string>('REDIS_URL') ?? 'redis://redis:6379',
      {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      },
    );
    this.redis.on('error', (error) => {
      this.logger.warn(`Redis market cache error: ${error.message}`);
    });
  }

  async getQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const nameMap = new Map(
      MARKET_PULSE.map((item) => [item.symbol, item.name] as const),
    );
    return Promise.all(
      this.normalizeSymbols(symbols).map(async (symbol) => ({
        name: nameMap.get(symbol),
        ...(await this.getQuote(symbol)),
      })),
    );
  }

  async getMarketPulse(): Promise<MarketQuote[]> {
    return this.getCachedQuotes(
      'market:pulse:v3',
      Promise.resolve([
        this.emptyQuote('KIS_FX:USDKRW', 'USD/KRW', 'KRW'),
        ...KR_INDEX_PULSE.map((item) => this.emptyQuote(item.symbol, item.name, 'KRW')),
        ...MARKET_PULSE.map((item) => this.emptyQuote(item.symbol, item.name, 'USD')),
      ]),
      async () => {
        const [globalPulse, krPulse, exchangeRate] = await Promise.all([
          this.getQuotes(MARKET_PULSE.map((item) => item.symbol)),
          this.getKoreanIndexPulse(),
          this.getUsdKrwExchangeRate().catch((error) => {
            this.logger.warn(
              `KIS USD/KRW exchange rate unavailable: ${
                error instanceof Error ? error.message : 'unknown error'
              }`,
            );
            return this.emptyQuote('KIS_FX:USDKRW', 'USD/KRW', 'KRW');
          }),
        ]);
        return [exchangeRate, ...krPulse, ...globalPulse];
      },
      20_000,
    );
  }

  async getStockQuote(symbol: string, market = 'US'): Promise<MarketQuote> {
    const normalizedSymbol = symbol.toUpperCase().trim();
    if (market === 'KR') {
      const masterStock = await this.stockMasterRepository.findOne({
        where: { symbol: normalizedSymbol, active: true },
      });
      return this.getKoreanQuote({
        symbol: normalizedSymbol,
        name: masterStock?.name ?? normalizedSymbol,
        marketDiv: masterStock?.market === 'KR:KOSDAQ' ? 'Q' : 'J',
      });
    }

    const masterStock = await this.stockMasterRepository.findOne({
      where: { symbol: normalizedSymbol, market: 'US', active: true },
    });
    return {
      name: masterStock?.name ?? normalizedSymbol,
      ...(await this.getQuote(normalizedSymbol)),
    };
  }

  private async getUsdKrwExchangeRate(): Promise<MarketQuote> {
    const key = 'market:exchange-rate:usd-krw';
    const cached = await this.redis
      .get(key)
      .then((value) => (value ? (JSON.parse(value) as MarketQuote) : null))
      .catch(() => null);

    if (cached?.current && cached.current > 0) {
      return cached;
    }

    const response = await this.kisGet<KisIndexChartPriceResponse>(
      '/uapi/overseas-price/v1/quotations/inquire-time-indexchartprice',
      {
        FID_COND_MRKT_DIV_CODE: 'X',
        FID_INPUT_ISCD: 'FX@KRW',
        FID_HOUR_CLS_CODE: '0',
        FID_PW_DATA_INCU_YN: 'N',
      },
      'FHKST03030200',
    );
    const output = response.output1 ?? {};
    const rate = this.toNumber(output.ovrs_nmix_prpr);
    if (rate <= 0) {
      throw new ServiceUnavailableException('KIS USD/KRW exchange rate is unavailable.');
    }

    const quote: MarketQuote = {
      symbol: 'KIS_FX:USDKRW',
      name: 'USD/KRW',
      currency: 'KRW',
      current: rate,
      change: this.toNumber(output.ovrs_nmix_prdy_vrss),
      percentChange: this.toNumber(output.prdy_ctrt),
      high: this.toNumber(output.ovrs_prod_hgpr),
      low: this.toNumber(output.ovrs_prod_lwpr),
      open: this.toNumber(output.ovrs_prod_oprc),
      previousClose: this.toNumber(output.ovrs_nmix_prdy_clpr),
      timestamp: Math.floor(Date.now() / 1000),
    };
    await this.redis.set(key, JSON.stringify(quote), 'EX', 5 * 60).catch(() => undefined);
    return quote;
  }

  async getDefaultUsStocks(): Promise<MarketQuote[]> {
    return this.getCachedQuotes(
      'market:stocks:us',
      this.getUsStockListFromDb(),
      () => this.getQuotes(DEFAULT_US_STOCKS),
      60_000,
    );
  }

  async getDefaultKrStocks(): Promise<MarketQuote[]> {
    return this.getCachedQuotes(
      'market:stocks:kr',
      this.getKrStockListFromDb(),
      () => this.getKoreanQuotes(DEFAULT_KR_STOCKS_CLEAN),
      60_000,
    );
  }

  async getKrSymbols(): Promise<StockSymbol[]> {
    const master = await this.stockMasterRepository.find({
      where: {
        active: true,
        market: In(['KR:KOSPI', 'KR:KOSDAQ']),
      },
      order: { market: 'ASC', name: 'ASC' },
    });
    if (master.length > 0) {
      return master.map((stock) => ({
        symbol: stock.symbol,
        displaySymbol: stock.standardCode ?? stock.symbol,
        description: stock.name,
        type: stock.type ?? 'Common Stock',
        currency: stock.currency,
      }));
    }

    await this.ensureDefaultStockProfiles();
    const profiles = await this.stockProfilesRepository.find({
      where: { symbol: In(DEFAULT_KR_STOCKS_CLEAN.map((stock) => stock.symbol)) },
    });
    const bySymbol = new Map(profiles.map((profile) => [profile.symbol, profile]));

    return DEFAULT_KR_STOCKS_CLEAN.map((stock) => ({
      symbol: stock.symbol,
      displaySymbol: stock.symbol,
      description: bySymbol.get(stock.symbol)?.name ?? stock.name,
      type: 'Common Stock',
      currency: 'KRW',
    }));
  }

  async getKoreanQuotes(stocks: KisStock[]): Promise<MarketQuote[]> {
    const nameMap = new Map(stocks.map((item) => [item.symbol, item.name] as const));
    const quotes: MarketQuote[] = [];

    for (const stock of stocks) {
      let quote = await this.getKoreanQuote(stock);
      if (quote.current === 0) {
        await this.sleep(500);
        quote = await this.getKoreanQuote(stock);
      }

      quotes.push({
        name: nameMap.get(stock.symbol),
        ...quote,
      });
      await this.sleep(500);
    }

    return quotes;
  }

  private async getKoreanIndexPulse(): Promise<MarketQuote[]> {
    const quotes: MarketQuote[] = [];

    for (const index of KR_INDEX_PULSE) {
      quotes.push(
        await this.getKoreanIndexQuote(
          index.code,
          index.symbol,
          index.name,
          index.marketClass,
          index.naverCode,
        ),
      );
      await this.sleep(300);
    }

    return quotes;
  }

  private async getKoreanIndexQuote(
    code: string,
    symbol: string,
    name: string,
    marketClass: string,
    naverCode: string,
  ): Promise<MarketQuote> {
    const naverQuote = await this.getNaverKoreanIndexQuote(
      naverCode,
      symbol,
      name,
    ).catch(() => null);
    if (naverQuote && naverQuote.current > 0) {
      return naverQuote;
    }

    try {
      const response = await this.kisGet<KisPriceResponse>(
        '/uapi/domestic-stock/v1/quotations/inquire-index-category-price',
        {
          FID_MRKT_CLS_CODE: marketClass,
          FID_BLNG_CLS_CODE: '0',
          FID_INPUT_ISCD: code,
        },
        'FHPUP02140000',
      );
      const output = response.output1 ?? response.output ?? {};

      return {
        symbol,
        name,
        currency: 'KRW',
        current: this.toNumber(output.bstp_nmix_prpr),
        change: this.toNumber(output.bstp_nmix_prdy_vrss),
        percentChange: this.toNumber(output.bstp_nmix_prdy_ctrt ?? output.prdy_ctrt),
        high: this.toNumber(output.bstp_nmix_hgpr),
        low: this.toNumber(output.bstp_nmix_lwpr),
        open: this.toNumber(output.bstp_nmix_oprc),
        previousClose:
          this.toNumber(output.bstp_nmix_prpr) -
          this.toNumber(output.bstp_nmix_prdy_vrss),
        timestamp: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      this.logger.warn(
        `KIS index fallback used for ${symbol}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      return {
        symbol,
        name,
        currency: 'KRW',
        current: 0,
        change: 0,
        percentChange: 0,
        high: 0,
        low: 0,
        open: 0,
        previousClose: 0,
        timestamp: Math.floor(Date.now() / 1000),
      };
    }
  }

  private async getNaverKoreanIndexQuote(
    naverCode: string,
    symbol: string,
    name: string,
  ): Promise<MarketQuote> {
    const response = await fetch(
      `https://m.stock.naver.com/api/index/${encodeURIComponent(naverCode)}/basic`,
      {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
    );

    if (!response.ok) {
      throw new ServiceUnavailableException('Naver index request failed.');
    }

    const body = (await response.json()) as {
      closePrice?: string;
      compareToPreviousClosePrice?: string;
      fluctuationsRatio?: string;
      openPrice?: string;
      highPrice?: string;
      lowPrice?: string;
      localTradedAt?: string;
    };
    const current = this.toNumber(body.closePrice);
    const change = this.toNumber(body.compareToPreviousClosePrice);

    return {
      symbol,
      name,
      currency: 'KRW',
      current,
      change,
      percentChange: this.toNumber(body.fluctuationsRatio),
      high: this.toNumber(body.highPrice),
      low: this.toNumber(body.lowPrice),
      open: this.toNumber(body.openPrice),
      previousClose: current - change,
      timestamp: body.localTradedAt
        ? Math.floor(new Date(body.localTradedAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
    };
  }

  async getUsSymbols(): Promise<StockSymbol[]> {
    const master = await this.stockMasterRepository.find({
      where: { active: true, market: 'US' },
      order: { name: 'ASC' },
    });
    if (master.length > 0) {
      return master.map((stock) => ({
        symbol: stock.symbol,
        displaySymbol: stock.standardCode ?? stock.symbol,
        description: stock.name,
        type: stock.type ?? 'Common Stock',
        currency: stock.currency,
      }));
    }

    await this.ensureDefaultStockProfiles();
    const profiles = await this.stockProfilesRepository.find({
      where: { symbol: In(DEFAULT_US_STOCKS) },
    });
    const bySymbol = new Map(profiles.map((profile) => [profile.symbol, profile]));

    return this.buildFallbackSymbols().map((symbol) => ({
      ...symbol,
      description: bySymbol.get(symbol.symbol)?.name ?? symbol.description,
    }));
  }

  async getStockDetail(symbol: string): Promise<StockDetail> {
    const normalizedSymbol = symbol.toUpperCase().trim();
    const [cachedProfile, quote] = await Promise.all([
      this.stockProfilesRepository.findOne({ where: { symbol: normalizedSymbol } }),
      this.getQuote(normalizedSymbol),
    ]);

    let profile: CompanyProfile;
    if (cachedProfile) {
      profile = this.toCompanyProfile(cachedProfile);
    } else {
      try {
        profile = await this.finnhubGet<CompanyProfile>('/stock/profile2', {
          symbol: normalizedSymbol,
        });
      } catch (error) {
        this.logger.warn(
          `Profile fallback used for ${normalizedSymbol}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
        profile = {
          ticker: normalizedSymbol,
          name: normalizedSymbol,
          exchange: 'Unknown',
          currency: 'USD',
        };
      }
    }

    const metrics = await this.getMetrics(normalizedSymbol).catch(() => null);

    return {
      symbol: normalizedSymbol,
      profile,
      metrics,
      overview: cachedProfile
        ? {
            en: cachedProfile.overviewEn,
            ko: cachedProfile.overviewKo,
            source: cachedProfile.source,
            fetchedAt: cachedProfile.fetchedAt,
          }
        : {
            en: this.buildEnglishOverview(normalizedSymbol, profile),
            ko: this.buildKoreanOverview(normalizedSymbol, profile),
            source: 'runtime_fallback_not_cached',
            fetchedAt: null,
          },
      quote,
    };
  }

  async getKoreanStockDetail(symbol: string): Promise<StockDetail> {
    const normalizedSymbol = symbol.toUpperCase().trim();
    const stock = DEFAULT_KR_STOCKS_CLEAN.find((item) => item.symbol === normalizedSymbol);
    const [cachedProfile, masterStock] = await Promise.all([
      this.stockProfilesRepository.findOne({
        where: { symbol: normalizedSymbol },
      }),
      this.stockMasterRepository.findOne({
        where: { symbol: normalizedSymbol, active: true },
      }),
    ]);
    const fallbackStock: KisStock = {
      symbol: normalizedSymbol,
      name: masterStock?.name ?? normalizedSymbol,
      marketDiv: masterStock?.market === 'KR:KOSDAQ' ? 'Q' : 'J',
    };
    const selectedStock = stock ?? fallbackStock;
    const [output, metrics] = await Promise.all([
      this.getKoreanPriceOutputCached(selectedStock),
      this.getKoreanMetricsCached(selectedStock),
    ]);
    const stockName = masterStock?.name ?? cachedProfile?.name ?? selectedStock.name;
    const quote: MarketQuote = {
      symbol: normalizedSymbol,
      name: stockName,
      currency: 'KRW',
      current: this.toNumber(output.stck_prpr),
      change: this.toNumber(output.prdy_vrss),
      percentChange: this.toNumber(output.prdy_ctrt),
      high: this.toNumber(output.stck_hgpr),
      low: this.toNumber(output.stck_lwpr),
      open: this.toNumber(output.stck_oprc),
      previousClose: this.toNumber(output.prdy_clpr ?? output.stck_prpr),
      timestamp: Math.floor(Date.now() / 1000),
    };
    const profile: CompanyProfile = {
      ticker: normalizedSymbol,
      name: stockName,
      exchange: masterStock?.exchange ?? 'KOSPI',
      currency: 'KRW',
      country: '대한민국',
      finnhubIndustry: '국내주식',
      marketCapitalization:
        this.toNumber(output.hts_avls) > 0 ? this.toNumber(output.hts_avls) * 100_000_000 : undefined,
    };
    if (cachedProfile) {
      profile.name = cachedProfile.name ?? profile.name;
      profile.exchange = cachedProfile.exchange ?? profile.exchange;
      profile.country = cachedProfile.country ?? profile.country;
      profile.ipo = cachedProfile.ipo ?? undefined;
      profile.weburl = cachedProfile.website ?? undefined;
      profile.logo = cachedProfile.logo ?? undefined;
      profile.finnhubIndustry = cachedProfile.industry ?? profile.finnhubIndustry;
    }

    return {
      symbol: normalizedSymbol,
      profile,
      metrics,
      ...(false ? { overview: {
        en: `${profile.name} is a Korean listed company traded on the KRX.`,
        ko: `${profile.name}은(는) 한국거래소에 상장된 국내 기업입니다.`,
        source: 'kis_quote',
        fetchedAt: null,
      } } : {}),
      ...(cachedProfile
        ? {
            overview: {
            en: cachedProfile.overviewEn,
            ko: cachedProfile.overviewKo,
            source: cachedProfile.source,
            fetchedAt: cachedProfile.fetchedAt,
            },
          }
        : {
            overview: {
            en: `${profile.name} is a Korean listed company traded on the KRX.`,
            ko: `${profile.name}은(는) 한국거래소에 상장된 국내 기업입니다.`,
            source: 'runtime_fallback_not_cached',
            fetchedAt: null,
            },
          }),
      quote,
    };
  }

  async refreshDefaultProfiles(): Promise<{ updated: number }> {
    let updated = 0;

    for (const symbol of DEFAULT_US_STOCKS) {
      try {
        await this.refreshProfile(symbol);
        updated += 1;
        await new Promise((resolve) => setTimeout(resolve, 350));
      } catch (error) {
        this.logger.warn(
          `Failed to refresh ${symbol}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    for (const stock of DEFAULT_KR_STOCKS_CLEAN) {
      try {
        await this.refreshKoreanProfile(stock);
        updated += 1;
        await new Promise((resolve) => setTimeout(resolve, 350));
      } catch (error) {
        this.logger.warn(
          `Failed to refresh ${stock.symbol}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    return { updated };
  }

  getMarketNews(category = 'general', market = 'US'): Promise<MarketNews[]> {
    if (market.toUpperCase() === 'KR' || category === 'kr') {
      return this.getNaverFinanceNews();
    }

    if (category === 'trending') {
      return this.getYahooTrendingNews();
    }

    if (category === 'crypto') {
      return this.getYahooSearchNews('bitcoin ethereum crypto market');
    }

    return this.getYahooSearchNews('stock market');
  }

  async getStockNews(symbol: string, market = 'US'): Promise<MarketNews[]> {
    const normalizedSymbol = symbol.toUpperCase().trim();
    const normalizedMarket = market.toUpperCase() === 'KR' ? 'KR' : 'US';
    const cacheKey = `market:stock-news:${normalizedMarket}:${normalizedSymbol}`;
    const cached = await this.redis.get(cacheKey).catch(() => null);

    if (cached) {
      try {
        return JSON.parse(cached) as MarketNews[];
      } catch {
        await this.redis.del(cacheKey).catch(() => undefined);
      }
    }

    const [master, profile] = await Promise.all([
      this.stockMasterRepository.findOne({
        where: { symbol: normalizedSymbol, market: normalizedMarket, active: true },
      }),
      this.stockProfilesRepository.findOne({ where: { symbol: normalizedSymbol } }),
    ]);
    const companyName = master?.name || profile?.name || normalizedSymbol;
    const query =
      normalizedMarket === 'KR'
        ? `${companyName} ${normalizedSymbol}`
        : `${companyName} ${normalizedSymbol} 주식`;

    let news: MarketNews[] = await this.getNaverSearchNews(query).catch((error) => {
      this.logger.warn(
        `Naver stock news request failed for ${normalizedSymbol}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return [] as MarketNews[];
    });

    if (!news.length && normalizedMarket === 'US') {
      news = await this.getFinnhubCompanyNews(normalizedSymbol).catch(() => []);
    }

    const latest = news
      .filter((item) => item.headline && item.url)
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 5);
    await this.redis
      .set(cacheKey, JSON.stringify(latest), 'EX', 10 * 60)
      .catch(() => undefined);
    return latest;
  }

  async getCandles(symbol: string, period: ChartPeriod): Promise<CandlePoint[]> {
    if (/^\d{6}$/.test(symbol)) {
      return this.getKoreanCandles(symbol, period);
    }

    const yahooSymbol = this.toYahooSymbol(symbol);
    const { range, interval } = this.toYahooRange(period);
    const url = new URL(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        yahooSymbol,
      )}`,
    );
    url.searchParams.set('range', range);
    url.searchParams.set('interval', interval);
    url.searchParams.set('includePrePost', 'false');
    url.searchParams.set('events', 'history');

    const response = await fetch(url);

    if (!response.ok) {
      throw new ServiceUnavailableException('Yahoo chart request failed.');
    }

    const body = (await response.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: Array<number | null>;
              high?: Array<number | null>;
              low?: Array<number | null>;
              close?: Array<number | null>;
              volume?: Array<number | null>;
            }>;
          };
        }>;
      };
    };
    const result = body.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];

    if (!result?.timestamp || !quote) {
      return [];
    }

    return result.timestamp
      .map((time, index) => ({
        time,
        open: quote.open?.[index] ?? 0,
        high: quote.high?.[index] ?? 0,
        low: quote.low?.[index] ?? 0,
        close: quote.close?.[index] ?? 0,
        volume: quote.volume?.[index] ?? 0,
      }))
      .filter((point) => point.open && point.high && point.low && point.close);
  }

  private async getKoreanCandles(symbol: string, period: ChartPeriod): Promise<CandlePoint[]> {
    const stock = DEFAULT_KR_STOCKS_CLEAN.find((item) => item.symbol === symbol) ?? {
      symbol,
      name: symbol,
      marketDiv: 'J' as KisMarketDiv,
    };
    const end = new Date();
    const start = new Date(end);

    switch (period) {
      case '1D':
        start.setDate(start.getDate() - 7);
        break;
      case '1M':
        start.setMonth(start.getMonth() - 2);
        break;
      case '1Y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case '3Y':
        start.setFullYear(start.getFullYear() - 3);
        break;
      case '5Y':
      case 'ALL':
        start.setFullYear(start.getFullYear() - 5);
        break;
      default:
        start.setMonth(start.getMonth() - 2);
        break;
    }

    const response = await this.kisGet<KisDailyCandleResponse>(
      '/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice',
      {
        FID_COND_MRKT_DIV_CODE: stock.marketDiv,
        FID_INPUT_ISCD: stock.symbol,
        FID_INPUT_DATE_1: this.formatKisDate(start),
        FID_INPUT_DATE_2: this.formatKisDate(end),
        FID_PERIOD_DIV_CODE: 'D',
        FID_ORG_ADJ_PRC: '1',
      },
      'FHKST03010100',
    );

    const rows = response.output2 ?? [];
    return rows
      .map((row) => ({
        time: this.kisDateToUnix(row.stck_bsop_date),
        open: this.toNumber(row.stck_oprc),
        high: this.toNumber(row.stck_hgpr),
        low: this.toNumber(row.stck_lwpr),
        close: this.toNumber(row.stck_clpr),
        volume: this.toNumber(row.acml_vol),
      }))
      .filter((point) => point.time > 0 && point.open > 0 && point.high > 0 && point.low > 0 && point.close > 0)
      .sort((a, b) => a.time - b.time);
  }

  private async getNaverFinanceNews(): Promise<MarketNews[]> {
    const news: MarketNews[] = [];

    for (const page of [1, 2, 3]) {
      const url = new URL('https://finance.naver.com/news/mainnews.naver');
      url.searchParams.set('page', String(page));
      const response = await fetch(url, {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new ServiceUnavailableException('Naver Finance news request failed.');
      }

      const html = new TextDecoder('euc-kr').decode(await response.arrayBuffer());
      news.push(...this.parseNaverFinanceNews(html));
    }

    const byUrl = new Map<string, MarketNews>();
    news.forEach((item) => {
      if (item.url && !byUrl.has(item.url)) {
        byUrl.set(item.url, item);
      }
    });

    return [...byUrl.values()].slice(0, 60);
  }

  private async getNaverSearchNews(query: string): Promise<MarketNews[]> {
    const clientId = this.configService.get<string>('NAVER_CLIENT_ID');
    const clientSecret = this.configService.get<string>('NAVER_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return [];
    }

    const url = new URL('https://openapi.naver.com/v1/search/news.json');
    url.searchParams.set('query', query);
    url.searchParams.set('display', '5');
    url.searchParams.set('start', '1');
    url.searchParams.set('sort', 'date');
    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('Naver Search news request failed.');
    }

    const body = (await response.json()) as {
      items?: Array<{
        title?: string;
        originallink?: string;
        link?: string;
        description?: string;
        pubDate?: string;
      }>;
    };

    return (body.items ?? []).map((item, index) => {
      const itemUrl = item.originallink || item.link || '';
      const headline = this.decodeHtml(this.stripHtml(item.title ?? ''));
      return {
        category: 'stock',
        datetime: item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : 0,
        headline,
        id: this.numericId(itemUrl || `${query}:${index}`),
        image: '',
        related: query,
        source: 'Naver News',
        summary: this.decodeHtml(this.stripHtml(item.description ?? '')) || headline,
        url: itemUrl,
      };
    });
  }

  private getFinnhubCompanyNews(symbol: string): Promise<MarketNews[]> {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 30);
    return this.finnhubGet<MarketNews[]>('/company-news', {
      symbol,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
  }

  private parseNaverFinanceNews(html: string): MarketNews[] {
    const articles: MarketNews[] = [];
    const itemPattern = /<li[^>]*class="[^"]*(?:block1|newsList)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemPattern.exec(html)) !== null) {
      const block = match[1];
      const linkMatch =
        block.match(/articleSubject[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ??
        block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) {
        continue;
      }

      const url = this.resolveNaverUrl(linkMatch[1]);
      const headline = this.decodeHtml(this.stripHtml(linkMatch[2]));
      const summaryMatch = block.match(/<dd[^>]*class="[^"]*articleSummary[^"]*"[^>]*>([\s\S]*?)<\/dd>/i);
      const summary = summaryMatch
        ? this.decodeHtml(
            this.stripHtml(summaryMatch[1].replace(/<span[^>]*class="[^"]*wdate[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')),
          )
        : headline;
      const sourceMatch = block.match(/<span[^>]*class="[^"]*press[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const dateMatch = block.match(/<span[^>]*class="[^"]*wdate[^"]*"[^>]*>([\s\S]*?)<\/span>/i);

      articles.push({
        category: 'kr',
        datetime: this.parseNaverNewsDate(this.stripHtml(dateMatch?.[1] ?? '')),
        headline,
        id: this.numericId(url),
        image: this.resolveNaverUrl(block.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? ''),
        related: '',
        source: this.decodeHtml(this.stripHtml(sourceMatch?.[1] ?? 'Naver Finance')),
        summary,
        url,
      });
    }

    return articles;
  }

  private resolveNaverUrl(value: string): string {
    if (!value) {
      return '';
    }

    if (value.startsWith('//')) {
      return `https:${value}`;
    }

    if (value.startsWith('http')) {
      return value;
    }

    return `https://finance.naver.com${value.startsWith('/') ? value : `/${value}`}`;
  }

  private async getYahooSearchNews(query: string): Promise<MarketNews[]> {
    const url = new URL('https://query1.finance.yahoo.com/v1/finance/search');
    url.searchParams.set('q', query);
    url.searchParams.set('newsCount', '30');
    url.searchParams.set('quotesCount', '0');

    const response = await fetch(url);

    if (!response.ok) {
      throw new ServiceUnavailableException('Yahoo Finance news request failed.');
    }

    const body = (await response.json()) as {
      news?: Array<{
        uuid?: string;
        title?: string;
        publisher?: string;
        link?: string;
        providerPublishTime?: number;
        thumbnail?: {
          resolutions?: Array<{ url?: string }>;
        };
      }>;
    };

    return this.mapYahooNews(body.news ?? []);
  }

  private async getYahooTrendingNews(): Promise<MarketNews[]> {
    const response = await fetch('https://query1.finance.yahoo.com/v1/finance/trending/US');

    if (!response.ok) {
      throw new ServiceUnavailableException('Yahoo Finance trending request failed.');
    }

    const body = (await response.json()) as {
      finance?: {
        result?: Array<{
          quotes?: Array<{ symbol?: string }>;
        }>;
      };
    };
    const symbols =
      body.finance?.result?.[0]?.quotes
        ?.map((quote) => quote.symbol)
        .filter((symbol): symbol is string => !!symbol)
        .slice(0, 5) ?? [];
    const newsGroups = await Promise.all(
      symbols.map((symbol) => this.getYahooSearchNews(symbol)),
    );
    const byUrl = new Map<string, MarketNews>();

    newsGroups.flat().forEach((item) => {
      if (!byUrl.has(item.url)) {
        byUrl.set(item.url, item);
      }
    });

    return [...byUrl.values()]
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 60);
  }

  private async refreshProfile(symbol: string): Promise<void> {
    const normalizedSymbol = symbol.toUpperCase().trim();
    const profile = await this.finnhubGet<CompanyProfile>('/stock/profile2', {
      symbol: normalizedSymbol,
    });

    await this.stockProfilesRepository.save({
      symbol: normalizedSymbol,
      name: profile.name ?? null,
      exchange: profile.exchange ?? null,
      currency: profile.currency ?? null,
      country: profile.country ?? null,
      ipo: profile.ipo ?? null,
      industry: profile.finnhubIndustry ?? null,
      website: profile.weburl ?? null,
      logo: profile.logo ?? null,
      marketCapitalization: profile.marketCapitalization ?? null,
      shareOutstanding: profile.shareOutstanding ?? null,
        overviewEn: this.buildEnglishOverview(normalizedSymbol, profile),
        overviewKo: this.buildKoreanOverview(normalizedSymbol, profile),
        source: 'finnhub_profile2_generated_overview',
      fetchedAt: new Date(),
    });
  }

  private async refreshKoreanProfile(stock: KisStock): Promise<void> {
    const dartProfile = await this.getDartCompanyProfile(stock).catch((error) => {
      this.logger.warn(
        `DART profile fallback used for ${stock.symbol}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    });
    const name = dartProfile?.corp_name ?? stock.name;
    const overviewKo = dartProfile
      ? `${name}은(는) DART 기업개황 기준 ${this.toKoreanCorpClass(
          dartProfile.corp_cls,
        )} 상장 법인입니다. 대표자는 ${dartProfile.ceo_nm || '미공시'}이며, 설립일은 ${
          this.formatDartDate(dartProfile.est_dt) || '미공시'
        }입니다. 본 개요는 매일 새벽 1시 배치로 DART 기업개황 데이터를 저장한 값입니다.`
      : `${name}은(는) 한국거래소에 상장된 국내 종목입니다. DART API 키 또는 corp code가 준비되면 매일 새벽 1시 배치에서 기업개황으로 갱신됩니다.`;
    const overviewEn = dartProfile
      ? `${name} is a Korean listed corporation based on DART company profile data. The profile is stored by the daily 1 AM batch job.`
      : `${name} is a Korean listed security traded on the KRX.`;

    await this.stockProfilesRepository.save({
      symbol: stock.symbol,
      name,
      exchange: stock.marketDiv === 'Q' ? 'KOSDAQ' : 'KOSPI',
      currency: 'KRW',
      country: '대한민국',
      ipo: this.formatDartDate(dartProfile?.est_dt) || null,
      industry: '국내주식',
      website: dartProfile?.hm_url || null,
      logo: null,
      marketCapitalization: null,
      shareOutstanding: null,
      overviewEn,
      overviewKo,
      source: dartProfile ? 'dart_company_batch' : 'krx_generated_batch',
      fetchedAt: new Date(),
    });
  }

  private async getDartCompanyProfile(stock: KisStock): Promise<{
    corp_name?: string;
    corp_name_eng?: string;
    stock_code?: string;
    ceo_nm?: string;
    corp_cls?: string;
    adres?: string;
    hm_url?: string;
    est_dt?: string;
  } | null> {
    const apiKey = this.configService.get<string>('DART_API_KEY');
    const corpCode = DART_CORP_CODES[stock.symbol];

    if (!apiKey || !corpCode) {
      return null;
    }

    const url = new URL('https://opendart.fss.or.kr/api/company.json');
    url.searchParams.set('crtfc_key', apiKey);
    url.searchParams.set('corp_code', corpCode);
    const response = await fetch(url);

    if (!response.ok) {
      throw new ServiceUnavailableException('DART company request failed.');
    }

    const body = (await response.json()) as {
      status?: string;
      message?: string;
      corp_name?: string;
      corp_name_eng?: string;
      stock_code?: string;
      ceo_nm?: string;
      corp_cls?: string;
      adres?: string;
      hm_url?: string;
      est_dt?: string;
    };

    if (body.status && body.status !== '000') {
      throw new ServiceUnavailableException(
        `DART company request failed: ${body.message ?? body.status}`,
      );
    }

    return body;
  }

  private async getQuote(symbol: string): Promise<MarketQuote> {
    try {
      const quote = await this.finnhubGet<FinnhubQuote>('/quote', { symbol });

      return {
        symbol,
        currency: 'USD',
        current: quote.c,
        change: quote.d,
        percentChange: quote.dp,
        high: quote.h,
        low: quote.l,
        open: quote.o,
        previousClose: quote.pc,
        timestamp: quote.t,
      };
    } catch (error) {
      this.logger.warn(
        `Finnhub quote fallback used for ${symbol}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      const yahooQuote = await this.getYahooQuote(symbol).catch(() => null);
      if (yahooQuote) {
        return yahooQuote;
      }

      return {
        symbol,
        currency: 'USD',
        current: 0,
        change: 0,
        percentChange: 0,
        high: 0,
        low: 0,
        open: 0,
        previousClose: 0,
        timestamp: Math.floor(Date.now() / 1000),
      };
    }
  }

  private async getKoreanQuote(stock: KisStock): Promise<MarketQuote> {
    try {
      const output = await this.getKoreanPriceOutputCached(stock);

      return {
        symbol: stock.symbol,
        name: stock.name,
        currency: 'KRW',
        current: this.toNumber(output.stck_prpr),
        change: this.toNumber(output.prdy_vrss),
        percentChange: this.toNumber(output.prdy_ctrt),
        high: this.toNumber(output.stck_hgpr),
        low: this.toNumber(output.stck_lwpr),
        open: this.toNumber(output.stck_oprc),
        previousClose: this.toNumber(output.prdy_clpr ?? output.stck_prpr),
        timestamp: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      this.logger.warn(
        `KIS quote fallback used for ${stock.symbol}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return {
        symbol: stock.symbol,
        name: stock.name,
        currency: 'KRW',
        current: 0,
        change: 0,
        percentChange: 0,
        high: 0,
        low: 0,
        open: 0,
        previousClose: 0,
        timestamp: Math.floor(Date.now() / 1000),
      };
    }
  }

  private async getKoreanMetrics(stock: KisStock): Promise<CompanyMetrics | null> {
    try {
      const response = await this.kisGet<KisPriceResponse>('/uapi/domestic-stock/v1/quotations/inquire-price', {
        FID_COND_MRKT_DIV_CODE: stock.marketDiv,
        FID_INPUT_ISCD: stock.symbol,
      });
      const output = response.output ?? {};
      await this.sleep(350);
      const financialRatio = await this.getKoreanFinancialRatio(stock).catch(() => null);
      await this.sleep(350);
      const profitRatio = await this.getKoreanProfitRatio(stock).catch(() => null);
      await this.sleep(350);
      const dividendYield = await this.getKoreanDividendYield(
        stock,
        this.toNumber(output.stck_prpr),
      ).catch(() => null);
      const sps = this.toOptionalNumber(financialRatio?.sps);
      const currentPrice = this.toNumber(output.stck_prpr);

      return {
        peTTM: this.toNumber(output.per),
        pbAnnual: this.toNumber(output.pbr),
        epsTTM: this.toOptionalNumber(financialRatio?.eps) ?? this.toNumber(output.eps),
        psTTM:
          this.toOptionalNumber(output.psr) ??
          (sps && currentPrice > 0 ? currentPrice / sps : null),
        roeTTM:
          this.toOptionalNumber(financialRatio?.roe_val) ??
          this.toOptionalNumber(profitRatio?.self_cptl_ntin_inrt),
        dividendYieldTTM:
          dividendYield ??
          this.toOptionalNumber(
          output.div_yld ?? output.dvdn_yld ?? output.stck_dvdn_yld,
          ),
        '52WeekHigh': this.toNumber(output.w52_hgpr ?? output.stck_hgpr_52w ?? output.stck_hgpr),
        '52WeekLow': this.toNumber(output.w52_lwpr ?? output.stck_lwpr_52w ?? output.stck_lwpr),
        currentPrice: this.toNumber(output.stck_prpr),
      };
    } catch (error) {
      this.logger.warn(
        `KIS metrics fallback used for ${stock.symbol}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  private async getKoreanMetricsCached(
    stock: KisStock,
  ): Promise<CompanyMetrics | null> {
    const key = `market:metrics:kr:${stock.symbol}`;
    const cached = await this.redis
      .get(key)
      .then((value) => (value ? (JSON.parse(value) as CompanyMetrics) : null))
      .catch(() => null);
    if (cached) {
      return cached;
    }

    void this.getKoreanBasicMetrics(stock)
      .then((metrics) =>
        metrics
          ? this.redis.set(key, JSON.stringify(metrics), 'EX', 6 * 60 * 60)
          : undefined,
      )
      .catch((error) => {
        this.logger.warn(
          `Background KIS metrics refresh failed for ${stock.symbol}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      });
    return null;
  }

  private async getKoreanBasicMetrics(
    stock: KisStock,
  ): Promise<CompanyMetrics | null> {
    const output = await this.getKoreanPriceOutputCached(stock);
    return {
      peTTM: this.toOptionalNumber(output.per),
      pbAnnual: this.toOptionalNumber(output.pbr),
      epsTTM: this.toOptionalNumber(output.eps),
      psTTM: this.toOptionalNumber(output.psr),
      dividendYieldTTM: this.toOptionalNumber(
        output.div_yld ?? output.dvdn_yld ?? output.stck_dvdn_yld,
      ),
      '52WeekHigh': this.toOptionalNumber(
        output.w52_hgpr ?? output.stck_hgpr_52w,
      ),
      '52WeekLow': this.toOptionalNumber(
        output.w52_lwpr ?? output.stck_lwpr_52w,
      ),
      currentPrice: this.toOptionalNumber(output.stck_prpr),
    };
  }

  private async getKoreanPriceOutputCached(
    stock: KisStock,
  ): Promise<Record<string, string | undefined>> {
    const key = `market:price:kr:${stock.symbol}`;
    const cached = await this.redis
      .get(key)
      .then((value) =>
        value
          ? (JSON.parse(value) as {
              updatedAt: number;
              output: Record<string, string | undefined>;
            })
          : null,
      )
      .catch(() => null);

    if (cached?.output) {
      if (Date.now() - cached.updatedAt > 20_000) {
        void this.refreshKoreanPriceOutput(key, stock).catch((error) => {
          this.logger.warn(
            `Background KIS price refresh failed for ${stock.symbol}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        });
      }
      return cached.output;
    }

    return this.refreshKoreanPriceOutput(key, stock);
  }

  private async refreshKoreanPriceOutput(
    key: string,
    stock: KisStock,
  ): Promise<Record<string, string | undefined>> {
    const output = await Promise.any([
      this.getNaverKoreanStockPriceOutput(stock.symbol),
      this.kisGet<KisPriceResponse>(
        '/uapi/domestic-stock/v1/quotations/inquire-price',
        {
          FID_COND_MRKT_DIV_CODE: stock.marketDiv,
          FID_INPUT_ISCD: stock.symbol,
        },
      ).then((response) => response.output ?? {}),
    ]);
    await this.redis
      .set(key, JSON.stringify({ updatedAt: Date.now(), output }), 'EX', 86400)
      .catch(() => undefined);
    return output;
  }

  private async getNaverKoreanStockPriceOutput(
    symbol: string,
  ): Promise<Record<string, string | undefined>> {
    const response = await fetch(
      `https://m.stock.naver.com/api/stock/${encodeURIComponent(symbol)}/basic`,
      {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
    );
    if (!response.ok) {
      throw new ServiceUnavailableException('Naver stock price request failed.');
    }
    const body = (await response.json()) as {
      closePrice?: string;
      compareToPreviousClosePrice?: string;
      fluctuationsRatio?: string;
      openPrice?: string;
      highPrice?: string;
      lowPrice?: string;
      marketValue?: string;
    };
    return {
      stck_prpr: body.closePrice,
      prdy_vrss: body.compareToPreviousClosePrice,
      prdy_ctrt: body.fluctuationsRatio,
      stck_oprc: body.openPrice,
      stck_hgpr: body.highPrice,
      stck_lwpr: body.lowPrice,
      hts_avls: body.marketValue,
    };
  }

  private async getKoreanFinancialRatio(
    stock: KisStock,
  ): Promise<Record<string, string | undefined> | null> {
    const response = await this.kisGet<KisListResponse>(
      '/uapi/domestic-stock/v1/finance/financial-ratio',
      {
        FID_COND_MRKT_DIV_CODE: stock.marketDiv,
        fid_input_iscd: stock.symbol,
        FID_DIV_CLS_CODE: '0',
      },
      'FHKST66430300',
    );

    return response.output?.[0] ?? null;
  }

  private async getKoreanProfitRatio(
    stock: KisStock,
  ): Promise<Record<string, string | undefined> | null> {
    const response = await this.kisGet<KisListResponse>(
      '/uapi/domestic-stock/v1/finance/profit-ratio',
      {
        FID_COND_MRKT_DIV_CODE: stock.marketDiv,
        fid_input_iscd: stock.symbol,
        FID_DIV_CLS_CODE: '0',
      },
      'FHKST66430400',
    );

    return response.output?.[0] ?? null;
  }

  private async getKoreanDividendYield(
    stock: KisStock,
    currentPrice: number,
  ): Promise<number | null> {
    if (currentPrice <= 0) {
      return null;
    }

    const response = await this.kisGet<KisListResponse>(
      '/uapi/domestic-stock/v1/ksdinfo/dividend',
      {
        CTS: '',
        GB1: '0',
        F_DT: this.formatKisDate(this.addYears(new Date(), -1)),
        T_DT: this.formatKisDate(new Date()),
        SHT_CD: stock.symbol,
        HIGH_GB: '',
      },
      'HHKDB669102C0',
    );
    const dividendPerShare = (response.output1 ?? [])
      .filter((item) => item.sht_cd === stock.symbol)
      .reduce((sum, item) => {
        return sum + (this.toOptionalNumber(item.per_sto_divi_amt) ?? 0);
      }, 0);

    return dividendPerShare > 0 ? (dividendPerShare / currentPrice) * 100 : null;
  }

  private async kisGet<T>(
    path: string,
    params: Record<string, string>,
    trId = 'FHKST01010100',
  ): Promise<T> {
    const appKey = this.configService.get<string>('KIS_APP_KEY');
    const appSecret = this.configService.get<string>('KIS_APP_SECRET');

    if (!appKey || !appSecret) {
      throw new ServiceUnavailableException('KIS API key is not configured.');
    }

    const token = await this.getKisAccessToken(appKey, appSecret);
    const baseUrl =
      this.configService.get<string>('KIS_BASE_URL')?.trim() ||
      'https://openapi.koreainvestment.com:9443';
    const url = new URL(`${baseUrl}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return this.withKisRequestLimit(async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await fetch(url, {
          headers: {
            authorization: `Bearer ${token}`,
            appkey: appKey,
            appsecret: appSecret,
            tr_id: trId,
            custtype: 'P',
          },
        });

        if (response.ok) {
          return response.json() as Promise<T>;
        }

        const body = await response.text().catch(() => '');
        if (body.includes('EGW00201') && attempt < 2) {
          await this.sleep(900);
          continue;
        }

        throw new ServiceUnavailableException(
          `KIS request failed (${path}) ${response.status}: ${body || response.statusText}`,
        );
      }

      throw new ServiceUnavailableException(`KIS request failed (${path})`);
    });
  }

  private async withKisRequestLimit<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.kisRequestQueue;
    let release: () => void = () => undefined;
    this.kisRequestQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      const waitMs = Math.max(0, 550 - (Date.now() - this.lastKisRequestAt));
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }
      this.lastKisRequestAt = Date.now();
      return await task();
    } finally {
      release();
    }
  }

  private async getKisAccessToken(appKey: string, appSecret: string): Promise<string> {
    const now = Date.now();
    if (this.kisTokenCache && this.kisTokenCache.expiresAt - 60_000 > now) {
      return this.kisTokenCache.token;
    }

    if (this.kisTokenPromise) {
      return this.kisTokenPromise;
    }

    const baseUrl =
      this.configService.get<string>('KIS_BASE_URL')?.trim() ||
      'https://openapi.koreainvestment.com:9443';
    this.kisTokenPromise = (async () => {
      const response = await fetch(`${baseUrl}/oauth2/tokenP`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          appkey: appKey,
          appsecret: appSecret,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new ServiceUnavailableException(
          `KIS token request failed ${response.status}: ${body || response.statusText}`,
        );
      }

      const token = (await response.json()) as KisTokenResponse;
      if (!token.access_token || !token.expires_in) {
        throw new ServiceUnavailableException('KIS token response is invalid.');
      }

      this.kisTokenCache = {
        token: token.access_token,
        expiresAt: now + token.expires_in * 1000,
      };

      return token.access_token;
    })().finally(() => {
      this.kisTokenPromise = null;
    });

    return this.kisTokenPromise;
  }

  private async getMetrics(symbol: string): Promise<CompanyMetrics | null> {
    try {
      const response = await this.finnhubGet<{
        metric?: CompanyMetrics;
      }>('/stock/metric', { symbol, metric: 'all' });

      return response.metric ?? null;
    } catch (error) {
      this.logger.warn(
        `Finnhub metrics fallback used for ${symbol}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  private async finnhubGet<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    const apiKey = this.configService.get<string>('FINNHUB_API_KEY');

    if (!apiKey) {
      throw new ServiceUnavailableException('Finnhub API key is not configured.');
    }

    const url = new URL(`${this.finnhubBaseUrl}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    url.searchParams.set('token', apiKey);

    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Finnhub request failed (${path}) ${response.status}: ${body || response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private normalizeSymbols(symbols: string[]): string[] {
    return [...new Set(symbols.map((symbol) => symbol.toUpperCase().trim()))]
      .filter(Boolean)
      .slice(0, 24);
  }

  private toYahooSymbol(symbol: string): string {
    if (symbol === 'BINANCE:BTCUSDT') {
      return 'BTC-USD';
    }

    if (symbol === 'BINANCE:ETHUSDT') {
      return 'ETH-USD';
    }

    return symbol;
  }

  private buildFallbackSymbols(): StockSymbol[] {
    return DEFAULT_US_STOCKS.map((symbol) => ({
      symbol,
      displaySymbol: symbol,
      description: symbol,
      type: symbol === 'QQQ' || symbol === 'SPY' || symbol === 'DIA' || symbol === 'GLD' || symbol === 'USO'
        ? 'ETP'
        : 'Common Stock',
      currency: 'USD',
    }));
  }

  private toYahooRange(period: ChartPeriod): { range: string; interval: string } {
    switch (period) {
      case '1D':
        return { range: '1d', interval: '5m' };
      case '1M':
        return { range: '1mo', interval: '1d' };
      case '1Y':
        return { range: '1y', interval: '1d' };
      case '3Y':
        return { range: '3y', interval: '1wk' };
      case '5Y':
        return { range: '5y', interval: '1wk' };
      case 'ALL':
        return { range: 'max', interval: '1mo' };
      default:
        return { range: '1mo', interval: '1d' };
    }
  }

  private mapYahooNews(
    news: Array<{
      uuid?: string;
      title?: string;
      publisher?: string;
      link?: string;
      providerPublishTime?: number;
      thumbnail?: {
        resolutions?: Array<{ url?: string }>;
      };
    }>,
  ): MarketNews[] {
    return news.map((item, index) => ({
      category: 'general',
      datetime: item.providerPublishTime ?? 0,
      headline: item.title ?? '',
      id: this.numericId(item.uuid ?? item.link ?? String(index)),
      image: item.thumbnail?.resolutions?.at(-1)?.url ?? '',
      related: '',
      source: item.publisher ?? 'Yahoo Finance',
      summary: item.title ?? '',
      url: item.link ?? '',
    }));
  }

  private numericId(value: string): number {
    return [...value].reduce((hash, char) => {
      return (hash * 31 + char.charCodeAt(0)) >>> 0;
    }, 7);
  }

  private stripHtml(value: string): string {
    return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private decodeHtml(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&lsquo;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&middot;/g, '·')
      .replace(/&#39;/g, "'")
      .trim();
  }

  private parseNaverNewsDate(value: string): number {
    const normalized = value.trim();
    const match = normalized.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (!match) {
      return Math.floor(Date.now() / 1000);
    }

    const [, year, month, day, hour, minute] = match;
    return Math.floor(
      new Date(`${year}-${month}-${day}T${hour}:${minute}:00+09:00`).getTime() / 1000,
    );
  }

  private formatDartDate(value: string | null | undefined): string | null {
    if (!value || !/^\d{8}$/.test(value)) {
      return null;
    }

    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  private toKoreanCorpClass(value: string | null | undefined): string {
    switch (value) {
      case 'Y':
        return '코스피';
      case 'K':
        return '코스닥';
      case 'N':
        return '코넥스';
      case 'E':
        return '기타';
      default:
        return '국내';
    }
  }

  private async getCachedQuotes(
    key: string,
    fallbackPromise: Promise<MarketQuote[]>,
    loader: () => Promise<MarketQuote[]>,
    maxAgeMs: number,
  ): Promise<MarketQuote[]> {
    const cached = await this.redis
      .get(key)
      .then((value) =>
        value
          ? (JSON.parse(value) as { updatedAt: number; data: MarketQuote[] })
          : null,
      )
      .catch(() => null);

    if (cached?.data?.length) {
      if (Date.now() - cached.updatedAt > maxAgeMs) {
        void this.refreshQuoteCache(key, loader).catch((error) => {
          this.logger.warn(
            `Market cache refresh failed for ${key}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        });
      }
      return cached.data;
    }

    const fallback = await fallbackPromise;
    const refresh = this.refreshQuoteCache(key, loader).catch(() => fallback);
    return Promise.race([
      refresh,
      new Promise<MarketQuote[]>((resolve) =>
        setTimeout(() => resolve(fallback), 1200),
      ),
    ]);
  }

  private async refreshQuoteCache(
    key: string,
    loader: () => Promise<MarketQuote[]>,
  ): Promise<MarketQuote[]> {
    const data = await loader();
    await this.redis
      .set(key, JSON.stringify({ updatedAt: Date.now(), data }))
      .catch(() => undefined);
    return data;
  }

  private async getUsStockListFromDb(): Promise<MarketQuote[]> {
    await this.ensureDefaultStockProfiles();
    const profiles = await this.stockProfilesRepository.find({
      where: { symbol: In(DEFAULT_US_STOCKS) },
    });
    const bySymbol = new Map(profiles.map((profile) => [profile.symbol, profile]));

    return DEFAULT_US_STOCKS.map((symbol) =>
      this.emptyQuote(symbol, bySymbol.get(symbol)?.name ?? symbol, 'USD'),
    );
  }

  private async getKrStockListFromDb(): Promise<MarketQuote[]> {
    await this.ensureDefaultStockProfiles();
    const symbols = DEFAULT_KR_STOCKS_CLEAN.map((stock) => stock.symbol);
    const profiles = await this.stockProfilesRepository.find({
      where: { symbol: In(symbols) },
    });
    const bySymbol = new Map(profiles.map((profile) => [profile.symbol, profile]));

    return DEFAULT_KR_STOCKS_CLEAN.map((stock) =>
      this.emptyQuote(
        stock.symbol,
        bySymbol.get(stock.symbol)?.name ?? stock.name,
        'KRW',
      ),
    );
  }

  private async ensureDefaultStockProfiles(): Promise<void> {
    const defaultSymbols = [
      ...DEFAULT_US_STOCKS,
      ...DEFAULT_KR_STOCKS_CLEAN.map((stock) => stock.symbol),
    ];
    const existing = await this.stockProfilesRepository.find({
      where: { symbol: In(defaultSymbols) },
      select: { symbol: true },
    });
    const existingSymbols = new Set(existing.map((profile) => profile.symbol));
    const now = new Date();
    const missingUs = DEFAULT_US_STOCKS.filter(
      (symbol) => !existingSymbols.has(symbol),
    ).map((symbol) => ({
      symbol,
      name: symbol,
      exchange: 'US',
      currency: 'USD',
      country: 'US',
      ipo: null,
      industry: symbol === 'QQQ' || symbol === 'SPY' || symbol === 'DIA' || symbol === 'GLD' || symbol === 'USO'
        ? 'ETF'
        : 'Common Stock',
      website: null,
      logo: null,
      marketCapitalization: null,
      shareOutstanding: null,
      overviewEn: `${symbol} is a default US market instrument.`,
      overviewKo: `${symbol}은(는) 기본 미국 시장 종목입니다.`,
      source: 'default_stock_seed',
      fetchedAt: now,
    }));
    const missingKr = DEFAULT_KR_STOCKS_CLEAN.filter(
      (stock) => !existingSymbols.has(stock.symbol),
    ).map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.marketDiv === 'Q' ? 'KOSDAQ' : 'KOSPI',
      currency: 'KRW',
      country: '대한민국',
      ipo: null,
      industry: '국내주식',
      website: null,
      logo: null,
      marketCapitalization: null,
      shareOutstanding: null,
      overviewEn: `${stock.name} is a default Korean listed company.`,
      overviewKo: `${stock.name}은(는) 한국거래소 상장 기본 종목입니다.`,
      source: 'default_stock_seed',
      fetchedAt: now,
    }));

    if (missingUs.length || missingKr.length) {
      await this.stockProfilesRepository.save([...missingUs, ...missingKr]);
    }
  }

  private emptyQuote(
    symbol: string,
    name: string,
    currency: 'USD' | 'KRW',
  ): MarketQuote {
    return {
      symbol,
      name,
      currency,
      current: 0,
      change: 0,
      percentChange: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  private toNumber(value: string | number | null | undefined): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value !== 'string') {
      return 0;
    }

    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toOptionalNumber(value: string | number | null | undefined): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatKisDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private addYears(date: Date, years: number): Date {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + years);
    return next;
  }

  private kisDateToUnix(value: string | undefined): number {
    if (!value || value.length !== 8) {
      return 0;
    }

    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    const time = Date.UTC(year, month, day);
    return Number.isFinite(time) ? Math.floor(time / 1000) : 0;
  }

  private async getYahooQuote(symbol: string): Promise<MarketQuote | null> {
    const yahooSymbol = this.toYahooSymbol(symbol);
    const url = new URL('https://query1.finance.yahoo.com/v7/finance/quote');
    url.searchParams.set('symbols', yahooSymbol);

    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as {
      quoteResponse?: {
        result?: Array<{
          regularMarketPrice?: number;
          regularMarketChange?: number;
          regularMarketChangePercent?: number;
          regularMarketDayHigh?: number;
          regularMarketDayLow?: number;
          regularMarketOpen?: number;
          regularMarketPreviousClose?: number;
          regularMarketTime?: number;
        }>;
      };
    };
    const result = body.quoteResponse?.result?.[0];

    if (!result) {
      return null;
    }

    return {
      symbol,
      current: result.regularMarketPrice ?? 0,
      change: result.regularMarketChange ?? 0,
      percentChange: result.regularMarketChangePercent ?? 0,
      high: result.regularMarketDayHigh ?? 0,
      low: result.regularMarketDayLow ?? 0,
      open: result.regularMarketOpen ?? 0,
      previousClose: result.regularMarketPreviousClose ?? 0,
      timestamp: result.regularMarketTime ?? Math.floor(Date.now() / 1000),
    };
  }

  private toCompanyProfile(profile: StockProfileEntity): CompanyProfile {
    return {
      country: profile.country ?? undefined,
      currency: profile.currency ?? undefined,
      exchange: profile.exchange ?? undefined,
      ipo: profile.ipo ?? undefined,
      marketCapitalization: profile.marketCapitalization ?? undefined,
      name: profile.name ?? undefined,
      shareOutstanding: profile.shareOutstanding ?? undefined,
      ticker: profile.symbol,
      weburl: profile.website ?? undefined,
      logo: profile.logo ?? undefined,
      finnhubIndustry: profile.industry ?? undefined,
    };
  }

  private buildEnglishOverview(symbol: string, profile: CompanyProfile): string {
    const name = profile.name || symbol;
    const industry = profile.finnhubIndustry || 'its listed industry';
    const exchange = profile.exchange || 'a US exchange';
    const country = profile.country || 'the United States';
    const ipo = profile.ipo ? ` The company has been public since ${profile.ipo}.` : '';
    const marketCap = profile.marketCapitalization
      ? ` Its market capitalization is approximately ${Math.round(
          profile.marketCapitalization,
        ).toLocaleString()} million ${profile.currency || 'USD'}.`
      : '';

    return `${name} is a publicly listed company in ${industry}, traded on ${exchange} and based in ${country}.${ipo}${marketCap} This overview is generated from cached company profile data and should be replaced with a full business description provider when available.`;
  }

  private buildKoreanOverview(symbol: string, profile: CompanyProfile): string {
    const name = profile.name || symbol;
    const industry = profile.finnhubIndustry || '해당 산업';
    const exchange = profile.exchange || '미국 거래소';
    const country = profile.country || '미국';
    const ipo = profile.ipo ? ` ${profile.ipo}에 상장된 기업입니다.` : '';
    const marketCap = profile.marketCapitalization
      ? ` 시가총액은 약 ${Math.round(profile.marketCapitalization).toLocaleString()}백만 ${
          profile.currency || 'USD'
        } 수준입니다.`
      : '';

    return `${name}는 ${country} 기반의 ${industry} 기업으로, ${exchange}에서 거래되고 있습니다.${ipo}${marketCap} 이 개요는 하루 1회 batch로 저장된 회사 프로필 데이터를 바탕으로 생성되며, 향후 DART/FMP/Finnhub premium 같은 장문 사업 설명 소스로 대체할 수 있습니다.`;
  }
}
