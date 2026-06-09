import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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
  MarketBriefing,
} from './finnhub-quote.dto';
import { StockProfileEntity } from './stock-profile.entity';
import { StockMasterEntity } from './stock-master.entity';
import { MarketBriefingEntity } from './market-briefing.entity';

const MARKET_PULSE = [
  { symbol: '^IXIC', name: 'Nasdaq Composite' },
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^DJI', name: 'Dow Jones' },
  { symbol: 'GC=F', name: 'Gold Futures' },
  { symbol: 'CL=F', name: 'WTI Crude Futures' },
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
  'TSM',
  'NVO',
  'ASML',
];

const DEFAULT_US_STOCK_NAMES: Record<string, string> = {
  ASML: 'ASML Holding ADR',
  NVO: 'Novo Nordisk ADR',
  TSM: 'Taiwan Semiconductor Manufacturing Company ADR',
};

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
    @InjectRepository(MarketBriefingEntity)
    private readonly marketBriefingsRepository: Repository<MarketBriefingEntity>,
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
      'market:pulse:v4',
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
      const symbols = master.map((stock) => ({
        symbol: stock.symbol,
        displaySymbol: stock.standardCode ?? stock.symbol,
        description: stock.name,
        type: stock.type ?? 'Common Stock',
        currency: stock.currency,
      }));
      const existingSymbols = new Set(symbols.map((stock) => stock.symbol));
      DEFAULT_US_STOCKS.forEach((symbol) => {
        if (!existingSymbols.has(symbol)) {
          symbols.push({
            symbol,
            displaySymbol: symbol,
            description: DEFAULT_US_STOCK_NAMES[symbol] ?? symbol,
            type: this.isEtpSymbol(symbol) ? 'ETP' : 'Common Stock',
            currency: 'USD',
          });
        }
      });
      return symbols;
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
      if (!profile.logo) {
        profile = await this.enrichCachedProfileLogo(normalizedSymbol, cachedProfile, profile);
      }
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

  private async enrichCachedProfileLogo(
    symbol: string,
    cachedProfile: StockProfileEntity,
    profile: CompanyProfile,
  ): Promise<CompanyProfile> {
    try {
      const freshProfile = await this.finnhubGet<CompanyProfile>('/stock/profile2', {
        symbol,
      });
      const nextProfile: CompanyProfile = {
        ...profile,
        country: freshProfile.country ?? profile.country,
        currency: freshProfile.currency ?? profile.currency,
        exchange: freshProfile.exchange ?? profile.exchange,
        finnhubIndustry: freshProfile.finnhubIndustry ?? profile.finnhubIndustry,
        ipo: freshProfile.ipo ?? profile.ipo,
        logo: freshProfile.logo ?? profile.logo,
        marketCapitalization:
          freshProfile.marketCapitalization ?? profile.marketCapitalization,
        name: freshProfile.name ?? profile.name,
        shareOutstanding: freshProfile.shareOutstanding ?? profile.shareOutstanding,
        ticker: freshProfile.ticker ?? profile.ticker,
        weburl: freshProfile.weburl ?? profile.weburl,
      };

      if (freshProfile.logo || freshProfile.weburl || freshProfile.name) {
        await this.stockProfilesRepository.update(
          { symbol },
          {
            country: nextProfile.country ?? cachedProfile.country,
            currency: nextProfile.currency ?? cachedProfile.currency,
            exchange: nextProfile.exchange ?? cachedProfile.exchange,
            industry: nextProfile.finnhubIndustry ?? cachedProfile.industry,
            ipo: nextProfile.ipo ?? cachedProfile.ipo,
            logo: nextProfile.logo ?? cachedProfile.logo,
            marketCapitalization:
              nextProfile.marketCapitalization ??
              cachedProfile.marketCapitalization,
            name: nextProfile.name ?? cachedProfile.name,
            shareOutstanding:
              nextProfile.shareOutstanding ?? cachedProfile.shareOutstanding,
            website: nextProfile.weburl ?? cachedProfile.website,
            fetchedAt: new Date(),
          },
        );
      }

      return nextProfile;
    } catch (error) {
      this.logger.warn(
        `Profile logo enrichment skipped for ${symbol}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return profile;
    }
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

  async getMarketNews(
    category = 'general',
    market = 'US',
    language = 'en',
  ): Promise<MarketNews[]> {
    if (market.toUpperCase() === 'KR' || category === 'kr') {
      return this.getNaverFinanceNews();
    }

    let news: MarketNews[];
    if (category === 'trending') {
      news = await this.getYahooTrendingNews();
    } else if (category === 'crypto') {
      news = await this.getYahooSearchNews('bitcoin ethereum crypto market');
    } else {
      news = await this.getYahooSearchNews('stock market');
    }

    return this.localizeNewsHeadlines(news, language);
  }

  async getLatestMarketBriefing(
    market = 'US',
    language = 'ko',
  ): Promise<MarketBriefing> {
    const normalizedMarket = market.toUpperCase() === 'KR' ? 'KR' : 'US';
    const briefing = await this.marketBriefingsRepository.findOne({
      where: { market: normalizedMarket },
      order: { generatedAt: 'DESC' },
    });
    if (briefing) {
      return this.toMarketBriefingDto(briefing);
    }
    return this.runMarketBriefing(normalizedMarket, language);
  }

  async getMarketBriefings(market = 'US'): Promise<MarketBriefing[]> {
    const normalizedMarket = market.toUpperCase() === 'KR' ? 'KR' : 'US';
    const briefings = await this.marketBriefingsRepository.find({
      where: { market: normalizedMarket },
      order: { generatedAt: 'DESC' },
      take: 100,
    });
    return briefings.map((briefing) => this.toMarketBriefingDto(briefing));
  }

  async getMarketBriefingById(id: string): Promise<MarketBriefing> {
    const briefing = await this.marketBriefingsRepository.findOne({ where: { id } });
    if (!briefing) {
      throw new NotFoundException('Market briefing not found.');
    }
    return this.toMarketBriefingDto(briefing);
  }

  @Cron('0 25 8 * * 2-6', { timeZone: 'Asia/Seoul' })
  async runScheduledUsMarketBriefing(): Promise<void> {
    await this.runScheduledMarketBriefing('US');
  }

  @Cron('0 55 15 * * 1-5', { timeZone: 'Asia/Seoul' })
  async runScheduledKrMarketBriefing(): Promise<void> {
    await this.runScheduledMarketBriefing('KR');
  }

  async runMarketBriefing(
    market = 'US',
    language = 'ko',
  ): Promise<MarketBriefing> {
    const normalizedMarket = market.toUpperCase() === 'KR' ? 'KR' : 'US';
    const [news, pulse] = await Promise.all([
      this.getMarketBriefingNews(normalizedMarket, language),
      this.getMarketPulse().catch(() => [] as MarketQuote[]),
    ]);
    if (news.length < 3) {
      throw new ServiceUnavailableException('Not enough market news to create a briefing.');
    }
    const generated = await this.generateMarketBriefing(
      normalizedMarket,
      news.slice(0, 20),
      pulse,
      language,
    );
    if (!generated) {
      throw new ServiceUnavailableException('휴장이었습니다.');
    }
    const datedTitle = this.withKoreanDatePrefix(generated.title);
    const imageUrl = await this.generateMarketBriefingImage(
      normalizedMarket,
      datedTitle,
      generated.keywords,
      generated.summaryLines,
    ).catch((error) => {
      this.logger.warn(
        `Market briefing image generation failed for ${normalizedMarket}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    });
    const saved = await this.marketBriefingsRepository.save(
        this.marketBriefingsRepository.create({
        market: normalizedMarket,
        title: datedTitle,
        titleCandidates: generated.titleCandidates,
        summary: generated.summary,
        summaryLines: generated.summaryLines,
        macroLines: generated.macroLines,
        companyNews: generated.companyNews,
        keywords: generated.keywords,
        watchPoints: generated.watchPoints,
        imageUrl,
        sources: generated.sources,
        source: 'openai',
        model: generated.model,
        imageModel: imageUrl
          ? this.configService.get<string>('OPENAI_IMAGE_MODEL')?.trim() ||
            'gpt-image-1'
          : null,
        generatedAt: new Date(),
      }),
    );
    return this.toMarketBriefingDto(saved);
  }

  private async getMarketBriefingNews(
    market: 'US' | 'KR',
    language: string,
  ): Promise<MarketNews[]> {
    if (market === 'KR') {
      const financeNews = await this.getMarketNews('kr', market, language).catch(
        () => [] as MarketNews[],
      );
      if (financeNews.length >= 3) {
        return financeNews;
      }

      const fallbackGroups = await Promise.all(
        ['코스피 코스닥 증시 마감', '한국 증시 마감', '코스피 반도체 코스닥'].map(
          (query) => this.getNaverSearchNews(query).catch(() => [] as MarketNews[]),
        ),
      );
      const byUrl = new Map<string, MarketNews>();
      [...financeNews, ...fallbackGroups.flat()].forEach((item) => {
        if (item.headline && item.url && !byUrl.has(item.url)) {
          byUrl.set(item.url, item);
        }
      });

      return [...byUrl.values()].sort((a, b) => b.datetime - a.datetime).slice(0, 60);
    }

    const symbolQueries = [
      'NVDA Nvidia stock AI chips',
      'MU Micron stock memory semiconductor',
      'AAPL Apple stock',
      'MSFT Microsoft stock AI cloud',
      'TSLA Tesla stock',
      'AMZN Amazon stock',
      'META Meta stock',
      'GOOGL Alphabet stock',
      'AMD stock semiconductor',
      'AVGO Broadcom stock',
      'ORCL Oracle stock',
    ];
    const newsGroups = await Promise.all([
      this.getYahooTrendingNews().catch(() => []),
      this.getYahooSearchNews('US stock market close Nasdaq S&P 500 Dow').catch(
        () => [],
      ),
      ...symbolQueries.map((query) =>
        this.getYahooSearchNews(query).catch(() => []),
      ),
    ]);
    const byUrl = new Map<string, MarketNews>();
    newsGroups.flat().forEach((item) => {
      if (item.headline && item.url && !byUrl.has(item.url)) {
        byUrl.set(item.url, item);
      }
    });

    return this.localizeNewsHeadlines(
      [...byUrl.values()].sort((a, b) => b.datetime - a.datetime).slice(0, 60),
      language,
    );
  }

  async getStockNews(
    symbol: string,
    market = 'US',
    language = 'en',
  ): Promise<MarketNews[]> {
    const normalizedSymbol = symbol.toUpperCase().trim();
    const normalizedMarket = market.toUpperCase() === 'KR' ? 'KR' : 'US';
    const cacheKey = `market:stock-news:v3:${normalizedMarket}:${normalizedSymbol}`;
    const cached = await this.redis.get(cacheKey).catch(() => null);

    if (cached) {
      try {
        return this.localizeNewsHeadlines(
          JSON.parse(cached) as MarketNews[],
          language,
        );
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
      const [finnhubNews, yahooNews] = await Promise.all([
        this.getFinnhubCompanyNews(normalizedSymbol).catch(() => []),
        this.getYahooSearchNews(`${companyName} ${normalizedSymbol}`).catch(
          () => [],
        ),
      ]);
      news = [...finnhubNews, ...yahooNews].filter((item) =>
        this.isStockRelatedNews(item, normalizedSymbol, companyName),
      );
    }
    if (!news.length && normalizedMarket === 'KR') {
      news = await this.getNaverStockNews(normalizedSymbol, companyName).catch((error) => {
        this.logger.warn(
          `Naver Finance stock news request failed for ${normalizedSymbol}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
        return [] as MarketNews[];
      });
    }
    if (normalizedMarket === 'KR') {
      news = news.filter((item) =>
        this.isKoreanStockRelatedNews(item, companyName),
      );
    }

    const latest = news
      .filter((item) => item.headline && item.url)
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 5);
    await this.redis
      .set(cacheKey, JSON.stringify(latest), 'EX', 10 * 60)
      .catch(() => undefined);
    return this.localizeNewsHeadlines(latest, language);
  }

  private isStockRelatedNews(
    news: MarketNews,
    symbol: string,
    companyName: string,
  ): boolean {
    const text = `${news.headline} ${news.summary}`.toLowerCase();
    const ignoredNameParts = new Set([
      'co',
      'company',
      'corp',
      'corporation',
      'group',
      'holdings',
      'inc',
      'incorporated',
      'limited',
      'ltd',
      'plc',
      'the',
    ]);
    const companyKeywords = companyName
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, ' ')
      .split(/\s+/)
      .filter(
        (part) =>
          part.length >= 3 &&
          !ignoredNameParts.has(part) &&
          !/^\d+$/.test(part),
      );
    const keywords = new Set([symbol.toLowerCase(), ...companyKeywords]);

    return [...keywords].some((keyword) => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(
        text,
      );
    });
  }

  private isKoreanStockRelatedNews(news: MarketNews, companyName: string): boolean {
    const normalizedName = companyName.replace(/\s+/g, '');
    if (!normalizedName) {
      return false;
    }
    return `${news.headline} ${news.summary}`
      .replace(/\s+/g, '')
      .includes(normalizedName);
  }

  async getCandles(symbol: string, period: ChartPeriod): Promise<CandlePoint[]> {
    const normalizedSymbol = symbol.toUpperCase().trim();
    const cacheKey = `market:candles:v1:${normalizedSymbol}:${period}`;
    const cached = await this.redis
      .get(cacheKey)
      .then((value) => (value ? (JSON.parse(value) as CandlePoint[]) : null))
      .catch(() => null);

    if (cached) {
      return cached;
    }

    const candles = await this.loadCandles(normalizedSymbol, period);
    const ttl = period === '1D' ? 60 : 6 * 60 * 60;
    await this.redis
      .set(cacheKey, JSON.stringify(candles), 'EX', ttl)
      .catch(() => undefined);
    return candles;
  }

  private async loadCandles(
    symbol: string,
    period: ChartPeriod,
  ): Promise<CandlePoint[]> {
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

  private async getNaverStockNews(
    symbol: string,
    companyName: string,
  ): Promise<MarketNews[]> {
    const articles: MarketNews[] = [];
    for (const page of [1, 2, 3, 4, 5]) {
      const url = new URL('https://finance.naver.com/item/news_news.naver');
      url.searchParams.set('code', symbol);
      url.searchParams.set('page', String(page));
      url.searchParams.set('sm', 'title_entity_id.basic');
      url.searchParams.set('clusterId', '');
      const response = await fetch(url, {
        headers: {
          referer: `https://finance.naver.com/item/main.naver?code=${symbol}`,
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new ServiceUnavailableException(
          'Naver Finance stock news request failed.',
        );
      }

      const html = new TextDecoder('euc-kr').decode(await response.arrayBuffer());
      const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let match: RegExpExecArray | null;

      while ((match = rowPattern.exec(html)) !== null && articles.length < 5) {
        const row = match[1];
        const link = row.match(
          /<a[^>]+href="([^"]*news_read\.naver[^"]*)"[^>]*class="tit"[^>]*>([\s\S]*?)<\/a>/i,
        );
        if (!link) {
          continue;
        }

        const itemUrl = this.resolveNaverUrl(link[1]);
        const headline = this.decodeHtml(this.stripHtml(link[2]));
        const source = this.decodeHtml(
          this.stripHtml(row.match(/<td[^>]*class="info"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? ''),
        );
        const date = this.stripHtml(
          row.match(/<td[^>]*class="date"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? '',
        );
        const item = {
          category: 'kr',
          datetime: this.parseNaverNewsDate(date),
          headline,
          id: this.numericId(itemUrl),
          image: '',
          related: symbol,
          source: source || 'Naver Finance',
          summary: headline,
          url: itemUrl,
        };
        if (this.isKoreanStockRelatedNews(item, companyName)) {
          articles.push(item);
        }
      }

      if (articles.length >= 5) {
        break;
      }
    }

    const byUrl = new Map<string, MarketNews>();
    articles.forEach((item) => byUrl.set(item.url, item));
    return [...byUrl.values()].slice(0, 5);
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

  private async generateMarketBriefing(
    market: 'US' | 'KR',
    news: MarketNews[],
    pulse: MarketQuote[],
    language: string,
  ): Promise<Omit<MarketBriefing, 'id' | 'imageUrl' | 'imageModel' | 'generatedAt'> | null> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const model =
      this.configService.get<string>('OPENAI_MODEL')?.trim() || 'gpt-5.5';
    if (!apiKey) {
      throw new ServiceUnavailableException('OpenAI API key is not configured.');
    }

    const sources = news.slice(0, 15).map((item) => ({
      headline: item.translatedHeadline || item.headline,
      source: item.source,
      url: item.url,
      datetime: item.datetime,
    }));
    const pulseLines = pulse
      .filter((item) => market === 'US' ? !item.symbol.startsWith('KIS_') : item.symbol.startsWith('KIS_'))
      .slice(0, 8)
      .map(
        (item) =>
          `${item.name ?? item.symbol}: ${item.current} (${item.change}, ${item.percentChange}%)`,
      );
    const targetLanguage = language.toLowerCase() === 'en' ? 'English' : 'Korean';
    const reportScope =
      market === 'KR'
        ? '한국장은 오늘 장 마감 이후 확인하는 오늘장 주식 요약입니다.'
        : '미국장은 한국 출근길에 보는 전날 미국장 주식 요약입니다.';

    const response = await this.fetchOpenAiWithRetry('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        service_tier: 'flex',
        input: [
          {
            role: 'system',
            content:
              'You are a market close report writer for Korean retail investors. Return only valid JSON matching the schema. Do not include markdown fences.',
          },
          {
            role: 'user',
            content: [
              `Market: ${market}`,
              `Language: ${targetLanguage}`,
              `Report scope: ${reportScope}`,
              'Instruction:',
              '중요: 이 프롬프트 안에 깨진 한글(mojibake)이 보이면 모두 무시하고, 아래 정상 한국어 지시문만 따라라.',
              '너는 한국 개인투자자를 위한 장 마감 리포트 작성자다.',
              '아래 제공된 시장 데이터와 뉴스 데이터만 근거로 사용해라.',
              '제공되지 않은 사실, 주가, 날짜, 기업 발언은 절대 추측하지 마라.',
              '투자 권유 표현은 피하고, 정보 전달 중심으로 작성해라.',
              '모든 문장은 존댓말 문체로 작성해라. "~했다", "~강조했다"가 아니라 "~했습니다", "~강조했습니다"처럼 끝내라.',
              '제목은 본문 날짜 기준으로 [M월 D일] 제목 형식이어야 한다.',
              '회사/종목 표기는 "삼성전자 #005930", "Nvidia #NVDA"처럼 괄호 없이 종목명 뒤에 #티커를 붙여라.',
              '미국장은 ETF보다 개별 기업 뉴스와 업종 이슈를 우선 정리해라. ETF 뉴스만 반복하지 마라.',
              '전일 미국장이 휴장이었을 경우 다른 내용 없이 정확히 "휴장이었습니다." 만 답변해라.',
              '금일 한국장이 휴장이었을 경우 다른 내용 없이 정확히 "휴장이었습니다." 만 답변해라.',
              '모든 문장은 존댓말 문체로 작성해라. "~했다", "~강조했다"가 아니라 "~했습니다", "~강조했습니다"처럼 끝내라.',
              '제목은 본문 날짜 기준으로 [M월 D일] 제목 형식이어야 한다.',
              '회사/종목 표기는 "삼성전자 #005930", "Nvidia #NVDA"처럼 괄호 없이 종목명 뒤에 #티커를 붙여라.',
              '미국장은 ETF보다 개별 기업 뉴스와 업종 이슈를 우선 정리해라. ETF 뉴스만 반복하지 마라.',
              '너는 한국 개인투자자를 위한 장 마감 리포트 작성자다.',
              '아래 제공된 시장 데이터와 뉴스 데이터만 근거로 사용해라.',
              '제공되지 않은 사실, 주가, 날짜, 기업 발언은 절대 추측하지 마라.',
              '투자 권유 표현은 피하고, 정보 전달 중심으로 작성해라.',
              '너는 한국 개인투자자를 위한 장 마감 리포트 작성자다.',
              '아래 제공된 시장 데이터와 뉴스 데이터만 근거로 사용해라.',
              '제공되지 않은 사실, 주가, 날짜, 기업 발언은 절대 추측하지 마라.',
              '투자 권유 표현은 피하고, 정보 전달 중심으로 작성해라.',
              `Market indicators:\n${pulseLines.join('\n') || 'No indicator data.'}`,
              `News:\n${sources
                .map((item, index) => `${index + 1}. ${item.headline} (${item.source})`)
                .join('\n') || 'No news.'}`,
              [
                '정상 출력 요구사항:',
                '휴장이 아닌 경우에는 JSON만 출력해라. 마크다운 코드블록은 쓰지 마라.',
                '1. 게시글 제목 후보 3개 작성',
                '2. 가장 좋은 제목 1개 선택',
                '3. 시장 전체 요약은 5줄로 작성',
                '4. 매크로 점검은 10~15줄로 작성해라.',
                '전일 시장 방향성에 실제로 영향을 준 매크로 요인만 선별해서 설명해라.',
                '탐색 범위는 지정학, 물가, CPI/PCE, 고용, 금리, 채권금리, 환율, 원자재, 유가, 정책, 중앙은행 발언, 재정 이슈, 수급, 신용위험, 변동성, 투자심리, 글로벌 주요국 증시 흐름, 업종 로테이션 등을 포함하되 이에 한정하지 마라.',
                '단, 위 항목들은 예시 탐색 범위일 뿐이며 모든 항목을 반드시 언급하지 마라.',
                '제공된 Market indicators와 매크로 관련 News에 근거가 있는 항목만 작성해라.',
                '근거가 없거나 시장 영향이 확인되지 않은 항목은 언급하지 마라.',
                '예를 들어 전일 CPI 관련 데이터나 뉴스가 제공되지 않았으면 CPI를 쓰지 마라.',
                '개별 기업 뉴스는 companyNews에서 따로 다루므로, 매크로 점검에서는 개별 기업 이슈를 중심 소재로 작성하지 마라.',
                '다만 개별 기업 뉴스가 지수, 업종, 투자심리, 수급에 영향을 준 경우에는 “반도체 업종”, “대형 기술주”, “2차전지주”처럼 업종·시장 단위로만 연결해서 설명해라.',
                '각 줄은 단순 나열이 아니라 “무슨 일이 있었고 → 시장이 어떻게 해석했고 → 어떤 지수·업종·자산에 영향을 줬는지”의 흐름으로 작성해라.',
                '중요도 기준은 “지수와 주요 업종 움직임을 설명하는 데 도움이 되는가”로 판단해라.',
                '5. 주요 종목/기업 뉴스 5~10개 작성',
                '6. 각 종목/기업 뉴스는 2~5줄로 작성',
                '7. 오늘의 핵심 키워드 3~5개 작성',
                '8. 마지막 단기 관전 포인트 2~3줄 작성',
                '9. PNG 그림은 별도 이미지 생성 API에서 만들 예정이므로 JSON에는 넣지 마라.',
                '10. 휴장일이면 JSON을 출력하지 말고 "휴장이었습니다." 만 출력해라.',
                'JSON 필드는 titleCandidates, title, summaryLines, macroLines, companyNews, keywords, watchPoints 만 사용해라.',
              ].join('\n'),
              [
                'Output goals:',
                '1. 게시글 제목 후보 3개 작성',
                '2. 가장 좋은 제목 1개 선택',
                '3. 시장 전체 요약 5줄 작성',
                '4. 매크로 점검 10~15줄 작성',
                '5. 주요 종목/기업 뉴스 5~10개 작성',
                '6. 각 종목/기업 뉴스는 2~5줄로 작성',
                '7. 오늘의 핵심 키워드 3~5개 작성',
                '8. 마지막 단기 관전 포인트 2~3줄 작성',
                '8. PNG 그림은 별도 이미지 생성 API에서 만들 예정이므로 JSON에는 넣지 마라.',
              ].join('\n'),
              [
                'Required output:',
                '1. 게시글 제목 후보 3개',
                '2. 가장 좋은 제목 1개 선택',
                '3. 시장 전체 요약 5줄',
                '4. 매크로 점검 10~15줄',
                '5. 주요 종목/기업 뉴스 5~10개. 종목명 옆에는 가능한 경우 #[티커명] 형식 포함',
                '6. 각 종목/기업 뉴스는 2~5줄',
                '7. 오늘의 핵심 키워드 3~5개',
                '8. 마지막 단기 관전 포인트 2~3줄',
              ].join('\n'),
            ].join('\n\n'),
          },
        ],
        max_output_tokens: 5000,
      }),
    }, 120_000, 300_000);

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `OpenAI briefing request failed: ${message || response.status}`,
      );
    }

    const body = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    const outputText =
      body.output_text ??
      body.output
        ?.flatMap((item) => item.content ?? [])
        .map((item) => item.text)
        .filter(Boolean)
        .join('\n');
    if (!outputText) {
      throw new ServiceUnavailableException('OpenAI briefing response is empty.');
    }

    const trimmedOutput = outputText.trim();
    if (trimmedOutput === '휴장이었습니다.') {
      return null;
    }

    const jsonText = this.extractJsonObject(trimmedOutput);
    const parsed = JSON.parse(jsonText) as Pick<
      MarketBriefing,
      | 'titleCandidates'
      | 'title'
      | 'summaryLines'
      | 'macroLines'
      | 'companyNews'
      | 'keywords'
      | 'watchPoints'
    >;
    const companyNews = this.normalizeBriefingCompanyNews(parsed.companyNews);
    return {
      titleCandidates: parsed.titleCandidates,
      market,
      title: parsed.title,
      summary: (parsed.summaryLines ?? []).join('\n\n'),
      summaryLines: parsed.summaryLines ?? [],
      macroLines: parsed.macroLines ?? [],
      companyNews: companyNews.length
        ? companyNews
        : this.buildBriefingCompanyNewsFallback(market, news),
      keywords: parsed.keywords ?? [],
      watchPoints: parsed.watchPoints ?? [],
      model,
      sources,
    };
  }

  private normalizeBriefingCompanyNews(
    value: MarketBriefing['companyNews'] | unknown,
  ): MarketBriefing['companyNews'] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        const record = item as {
          symbol?: unknown;
          name?: unknown;
          headline?: unknown;
          lines?: unknown;
          summary?: unknown;
          description?: unknown;
        };
        const symbol = typeof record.symbol === 'string' ? record.symbol : '';
        const name = typeof record.name === 'string' ? record.name : symbol;
        const headline =
          typeof record.headline === 'string'
            ? record.headline
            : typeof record.summary === 'string'
              ? record.summary
              : '';
        const fallbackLine =
          typeof record.description === 'string'
            ? record.description
            : headline;
        const lines = Array.isArray(record.lines)
          ? record.lines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
          : [];

        return {
          symbol,
          name,
          headline,
          lines: lines.length ? lines : fallbackLine ? [fallbackLine] : [],
        };
      })
      .filter((item) => item.name || item.headline || item.lines.length);
  }

  private buildBriefingCompanyNewsFallback(
    market: 'US' | 'KR',
    news: MarketNews[],
  ): MarketBriefing['companyNews'] {
    const marketNews = news
      .map((item) => ({
        item,
        symbol: this.extractBriefingNewsSymbol(item),
      }))
      .sort((a, b) => {
        const symbolScore = Number(Boolean(b.symbol)) - Number(Boolean(a.symbol));
        if (symbolScore !== 0) {
          return symbolScore;
        }
        return b.item.datetime - a.item.datetime;
      });
    const seen = new Set<string>();
    return marketNews
      .filter(({ item }) => item.headline && item.url)
      .filter(({ item }) => {
        if (seen.has(item.url)) {
          return false;
        }
        seen.add(item.url);
        return true;
      })
      .slice(0, 5)
      .map(({ item, symbol }) => {
        const headline = item.translatedHeadline || item.headline;
        const name = symbol || (market === 'KR' ? '한국증시' : '미국증시');
        return {
          symbol,
          name,
          headline,
          lines: [item.summary || headline],
        };
      });
  }

  private extractBriefingNewsSymbol(news: MarketNews): string {
    const headline = news.translatedHeadline || news.headline;
    const tagged = headline.match(/#([A-Z0-9.]{1,10}|\d{6})/i)?.[1];
    if (tagged) {
      return tagged.toUpperCase();
    }

    const knownSymbols = new Set([
      'NVDA',
      'MU',
      'AAPL',
      'MSFT',
      'TSLA',
      'AMZN',
      'META',
      'GOOGL',
      'AMD',
      'AVGO',
      'ORCL',
    ]);
    const relatedParts = news.related.toUpperCase().split(/[^A-Z0-9.]+/);
    const relatedSymbol = relatedParts.find((part) =>
      knownSymbols.has(part) || /^\d{6}$/.test(part),
    );
    return relatedSymbol ?? '';
  }

  private async fetchOpenAiWithRetry(
    url: string,
    init: RequestInit,
    firstTimeoutMs: number,
    retryTimeoutMs: number,
  ): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(firstTimeoutMs),
      });
      if (!this.shouldRetryOpenAiResponse(response)) {
        return response;
      }

      const message = await response.clone().text().catch(() => '');
      this.logger.warn(
        `OpenAI request retrying after retryable response ${response.status}: ${
          message || response.statusText
        }`,
      );
    } catch (error) {
      if (!this.isRetryableOpenAiError(error)) {
        throw error;
      }
      this.logger.warn(
        `OpenAI request retrying after retryable error: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    return fetch(url, {
      ...init,
      signal: AbortSignal.timeout(retryTimeoutMs),
    });
  }

  private shouldRetryOpenAiResponse(response: Response): boolean {
    return response.status === 429;
  }

  private isRetryableOpenAiError(error: unknown): boolean {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return true;
    }
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('resource unavailable') ||
      message.includes('429')
    );
  }

  private extractJsonObject(value: string): string {
    const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    if (fenced) {
      return fenced;
    }
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return value.slice(start, end + 1);
    }
    return value;
  }

  private withKoreanDatePrefix(title: string): string {
    const now = new Date();
    const koreaDate = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
    );
    const prefix = `[${koreaDate.getMonth() + 1}월 ${koreaDate.getDate()}일]`;
    const cleanTitle = title.replace(/^\[\d{1,2}월\s+\d{1,2}일\]\s*/, '').trim();
    return `${prefix} ${cleanTitle}`;
  }

  private async generateMarketBriefingImage(
    market: 'US' | 'KR',
    title: string,
    keywords: string[],
    summaryLines: string[],
  ): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const model =
      this.configService.get<string>('OPENAI_IMAGE_MODEL')?.trim() ||
      'gpt-image-1';
    if (!apiKey) {
      throw new ServiceUnavailableException('OpenAI API key is not configured.');
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        size: '1536x1024',
        prompt: [
          'Create a polished 16:9 PNG editorial cover image for a Korean retail investor market close report.',
          'Style: premium financial PPT cover, clean dashboard composition, restrained dark navy and white background, subtle green/red market accents, professional typography feel.',
          'Use 3 to 5 simple visual blocks at most. Avoid clutter, tiny text, fake logos, overloaded numbers, comic style, neon cyberpunk, or sensational news graphics.',
          'Do not render Korean text, article titles, ticker labels, numbers, or readable words inside the image because generated text can break. Use abstract charts, icons, panels, and clean visual hierarchy instead.',
          'The image should work as a top banner inside a web article without cropping important content.',
          `Market: ${market}`,
          `Title: ${title}`,
          `Keywords: ${keywords.join(', ')}`,
          `Facts only from summary: ${summaryLines.slice(0, 5).join(' / ')}`,
          'No fake logos, no specific unprovided prices, no investment advice text.',
        ].join('\n'),
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `OpenAI image request failed: ${message || response.status}`,
      );
    }
    const body = (await response.json()) as {
      data?: Array<{ b64_json?: string }>;
    };
    const image = body.data?.[0]?.b64_json;
    if (!image) {
      throw new ServiceUnavailableException('OpenAI image response is empty.');
    }
    return `data:image/png;base64,${image}`;
  }

  private async runScheduledMarketBriefing(market: 'US' | 'KR'): Promise<void> {
    try {
      const latest = await this.marketBriefingsRepository.findOne({
        where: { market },
        order: { generatedAt: 'DESC' },
      });
      if (
        latest &&
        new Date(latest.generatedAt).toDateString() === new Date().toDateString()
      ) {
        return;
      }
      const briefing = await this.runMarketBriefing(market);
      this.logger.log(
        `Scheduled ${market} market briefing generated: ${briefing.id}`,
      );
    } catch (error) {
      this.logger.warn(
        `Scheduled ${market} market briefing skipped: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private toMarketBriefingDto(entity: MarketBriefingEntity): MarketBriefing {
    return {
      id: entity.id,
      market: entity.market,
      title: entity.title,
      titleCandidates: entity.titleCandidates,
      summary: entity.summary,
      summaryLines: entity.summaryLines,
      macroLines: entity.macroLines ?? [],
      companyNews: entity.companyNews,
      keywords: entity.keywords,
      watchPoints: entity.watchPoints,
      imageUrl: entity.imageUrl,
      generatedAt: Math.floor(entity.generatedAt.getTime() / 1000),
      model: entity.model,
      imageModel: entity.imageModel,
      sources: entity.sources,
    };
  }

  private async localizeNewsHeadlines(
    news: MarketNews[],
    language: string,
  ): Promise<MarketNews[]> {
    if (language.toLowerCase() !== 'ko') {
      return news;
    }

    return Promise.all(
      news.map(async (item) => ({
        ...item,
        translatedHeadline: await this.translateToKorean(item.headline),
      })),
    );
  }

  private async translateToKorean(text: string): Promise<string> {
    if (!text || /[가-힣]/.test(text)) {
      return text;
    }

    const key = `translation:news:ko:${this.numericId(text)}`;
    const cached = await this.redis.get(key).catch(() => null);
    if (cached && /[가-힣]/.test(cached)) {
      return cached;
    }

    const translated =
      (await this.translateWithPapago(text).catch(() => null)) ??
      (await this.translateWithGoogle(text).catch(() => null)) ??
      text;
    await this.redis
      .set(key, translated, 'EX', 30 * 24 * 60 * 60)
      .catch(() => undefined);
    return translated;
  }

  private async translateWithPapago(text: string): Promise<string | null> {
    const clientId = this.configService.get<string>('NAVER_CLIENT_ID');
    const clientSecret = this.configService.get<string>('NAVER_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return null;
    }

    const response = await fetch('https://openapi.naver.com/v1/papago/n2mt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      body: new URLSearchParams({ source: 'en', target: 'ko', text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as {
      message?: { result?: { translatedText?: string } };
    };
    return result.message?.result?.translatedText?.trim() || null;
  }

  private async translateWithGoogle(text: string): Promise<string | null> {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'en');
    url.searchParams.set('tl', 'ko');
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', text);
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as Array<
      Array<Array<string | null>> | string | null
    >;
    const chunks = Array.isArray(result[0]) ? result[0] : [];
    const translated = chunks
      .map((chunk) => (Array.isArray(chunk) ? chunk[0] : ''))
      .filter((chunk): chunk is string => typeof chunk === 'string')
      .join('');
    return translated.trim() || null;
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

    return this.mapYahooNews(body.news ?? [], query);
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
    if (this.isYahooOnlyQuoteSymbol(symbol)) {
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

  private isYahooOnlyQuoteSymbol(symbol: string): boolean {
    return symbol.startsWith('^') || symbol.includes('=');
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

    const metrics =
      (await this.getKoreanMetrics(stock)) ??
      (await this.getKoreanBasicMetrics(stock).catch(() => null));
    if (metrics) {
      await this.redis
        .set(key, JSON.stringify(metrics), 'EX', 6 * 60 * 60)
        .catch(() => undefined);
    }
    return metrics;
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
      description: DEFAULT_US_STOCK_NAMES[symbol] ?? symbol,
      type: this.isEtpSymbol(symbol) ? 'ETP' : 'Common Stock',
      currency: 'USD',
    }));
  }

  private isEtpSymbol(symbol: string): boolean {
    return ['QQQ', 'SPY', 'DIA', 'GLD', 'USO'].includes(symbol);
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
    related = '',
  ): MarketNews[] {
    return news.map((item, index) => ({
      category: 'general',
      datetime: item.providerPublishTime ?? 0,
      headline: item.title ?? '',
      id: this.numericId(item.uuid ?? item.link ?? String(index)),
      image: item.thumbnail?.resolutions?.at(-1)?.url ?? '',
      related,
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
      .replace(/&apos;/g, "'")
      .replace(/&hellip;/g, '...')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&lsquo;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&middot;/g, '·')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .trim();
  }

  private parseNaverNewsDate(value: string): number {
    const normalized = value.trim();
    const match = normalized.match(
      /(\d{4})[-.](\d{2})[-.](\d{2})\s+(\d{2}):(\d{2})/,
    );
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
      industry: this.isEtpSymbol(symbol) ? 'ETF' : 'Common Stock',
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
      await this.stockProfilesRepository.upsert([...missingUs, ...missingKr], [
        'symbol',
      ]);
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
      return this.getYahooChartQuote(symbol);
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

    if (!result?.regularMarketPrice) {
      return this.getYahooChartQuote(symbol);
    }

    return {
      symbol,
      currency: 'USD',
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

  private async getYahooChartQuote(symbol: string): Promise<MarketQuote | null> {
    const yahooSymbol = this.toYahooSymbol(symbol);
    const url = new URL(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        yahooSymbol,
      )}`,
    );
    url.searchParams.set('range', '1d');
    url.searchParams.set('interval', '1m');

    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            regularMarketDayHigh?: number;
            regularMarketDayLow?: number;
            regularMarketOpen?: number;
            regularMarketTime?: number;
          };
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: Array<number | null>;
              high?: Array<number | null>;
              low?: Array<number | null>;
              close?: Array<number | null>;
            }>;
          };
        }>;
      };
    };
    const result = body.chart?.result?.[0];
    const meta = result?.meta;
    const quote = result?.indicators?.quote?.[0];
    const closes = quote?.close?.filter((value): value is number => typeof value === 'number') ?? [];
    const current = meta?.regularMarketPrice ?? closes.at(-1) ?? 0;
    const previousClose = meta?.chartPreviousClose ?? meta?.previousClose ?? 0;
    const change = previousClose > 0 ? current - previousClose : 0;
    const percentChange = previousClose > 0 ? (change / previousClose) * 100 : 0;
    const highs = quote?.high?.filter((value): value is number => typeof value === 'number') ?? [];
    const lows = quote?.low?.filter((value): value is number => typeof value === 'number') ?? [];
    const opens = quote?.open?.filter((value): value is number => typeof value === 'number') ?? [];

    if (current <= 0) {
      return null;
    }

    return {
      symbol,
      currency: 'USD',
      current,
      change,
      percentChange,
      high: meta?.regularMarketDayHigh ?? (highs.length ? Math.max(...highs) : 0),
      low: meta?.regularMarketDayLow ?? (lows.length ? Math.min(...lows) : 0),
      open: meta?.regularMarketOpen ?? opens[0] ?? 0,
      previousClose,
      timestamp:
        meta?.regularMarketTime ??
        result?.timestamp?.at(-1) ??
        Math.floor(Date.now() / 1000),
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
