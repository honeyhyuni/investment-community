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
  StockFinancial,
} from './finnhub-quote.dto';
import { StockProfileEntity } from './stock-profile.entity';
import { StockMasterEntity } from './stock-master.entity';
import { MarketBriefingEntity } from './market-briefing.entity';
import { StockFinancialEntity } from './stock-financial.entity';

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
    @InjectRepository(StockFinancialEntity)
    private readonly stockFinancialRepository: Repository<StockFinancialEntity>,
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
    const financials = await this.getKoreanFinancials(normalizedSymbol);
    const fallbackStock: KisStock = {
      symbol: normalizedSymbol,
      name: masterStock?.name ?? normalizedSymbol,
      marketDiv: masterStock?.market === 'KR:KOSDAQ' ? 'Q' : 'J',
    };
    const selectedStock = stock ?? fallbackStock;
    const output = await this.getKoreanPriceOutputCached(selectedStock);
    const metrics = this.buildKoreanMetricsFromFinancials(
      financials[0] ?? null,
      output,
    );
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
      financials,
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

  async updateMarketBriefing(
    id: string,
    body: Partial<MarketBriefing>,
  ): Promise<MarketBriefing> {
    const briefing = await this.marketBriefingsRepository.findOne({ where: { id } });
    if (!briefing) {
      throw new NotFoundException('Market briefing not found.');
    }

    if (typeof body.title === 'string') {
      briefing.title = body.title.trim().slice(0, 240);
    }

    if (Array.isArray(body.summaryLines)) {
      briefing.summaryLines = this.cleanBriefingLines(body.summaryLines);
      briefing.summary = briefing.summaryLines.join('\n\n');
    }

    if (Array.isArray(body.macroLines)) {
      briefing.macroLines = this.cleanBriefingLines(body.macroLines);
    }

    if (Array.isArray(body.companyNews)) {
      briefing.companyNews = this.normalizeBriefingCompanyNews(body.companyNews);
    }

    if (Array.isArray(body.keywords)) {
      briefing.keywords = this.cleanBriefingLines(body.keywords);
    }

    if (Array.isArray(body.watchPoints)) {
      briefing.watchPoints = this.cleanBriefingLines(body.watchPoints);
    }

    const saved = await this.marketBriefingsRepository.save(briefing);
    return this.toMarketBriefingDto(saved);
  }

  async deleteMarketBriefing(id: string): Promise<void> {
    const result = await this.marketBriefingsRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Market briefing not found.');
    }
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
    const [news, macroNews, pulse] = await Promise.all([
      this.getMarketBriefingNews(normalizedMarket, language),
      this.getMarketBriefingMacroNews(normalizedMarket, language),
      this.getMarketPulse().catch(() => [] as MarketQuote[]),
    ]);
    const briefingNews = this.mergeMarketNews([
      ...macroNews.slice(0, 12),
      ...news,
    ]);

    if (briefingNews.length < 3 && !pulse.length) {
      throw new ServiceUnavailableException('Not enough market news to create a briefing.');
    }
    const generated = await this.generateMarketBriefing(
      normalizedMarket,
      briefingNews.slice(0, 30),
      pulse,
      language,
    );
    if (!generated) {
      throw new ServiceUnavailableException('휴장이었습니다.');
    }
    generated.companyNews = await this.enrichBriefingCompanyNewsChanges(
      normalizedMarket,
      generated.companyNews,
    );
    const datedTitle = this.withKoreanDatePrefix(generated.title);
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
        imageUrl: null,
        sources: generated.sources,
        source: 'openai',
        model: generated.model,
        imageModel: null,
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
      return this.getMarketNews('kr', market, language);
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

  private async getMarketBriefingMacroNews(
    market: 'US' | 'KR',
    language: string,
  ): Promise<MarketNews[]> {
    const queries =
      market === 'KR'
        ? [
            '한국 증시 마감 금리 환율 유가',
            '코스피 코스닥 마감 원달러 환율 외국인 기관',
            '한국 물가 금리 채권 환율 증시 영향',
            '한국 증시 지정학 유가 반도체 2차전지',
          ]
        : [
            'CPI inflation market reaction stocks bonds',
            'PPI inflation market reaction stocks bonds',
            'PCE inflation Federal Reserve market reaction',
            'FOMC Fed rate cut Treasury yields stocks',
            'jobs report payrolls unemployment market reaction',
            'Treasury yields dollar stocks market reaction',
            'oil prices geopolitical risk stocks market reaction',
            'tariff policy stocks market reaction',
          ];

    const groups = await Promise.all(
      queries.map((query) =>
        (market === 'KR'
          ? this.getNaverSearchNews(query)
          : this.getYahooSearchNews(query)
        ).catch((error) => {
          this.logger.warn(
            `Market briefing macro news skipped for "${query}": ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
          return [] as MarketNews[];
        }),
      ),
    );

    const scored = this.mergeMarketNews(groups.flat())
      .map((item) => ({
        item,
        score: this.scoreMacroBriefingNews(item, market),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return b.item.datetime - a.item.datetime;
      })
      .map(({ item }) => item)
      .slice(0, 20);

    return this.localizeNewsHeadlines(scored, language);
  }

  private mergeMarketNews(news: MarketNews[]): MarketNews[] {
    const byKey = new Map<string, MarketNews>();

    news.forEach((item) => {
      const key = item.url || `${item.source}:${item.headline}`;
      if (!item.headline || !key || byKey.has(key)) {
        return;
      }
      byKey.set(key, item);
    });

    return [...byKey.values()].sort((a, b) => b.datetime - a.datetime);
  }

  private scoreMacroBriefingNews(news: MarketNews, market: 'US' | 'KR'): number {
    const text = [
      news.headline,
      news.translatedHeadline,
      news.summary,
      news.source,
      news.related,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const coreKeywords =
      market === 'KR'
        ? [
            '물가',
            '소비자물가',
            '금리',
            '기준금리',
            '한국은행',
            '환율',
            '원달러',
            '외국인',
            '기관',
            '채권',
          ]
        : [
            'cpi',
            'core cpi',
            'consumer price index',
            'ppi',
            'producer price index',
            'pce',
            'core pce',
            'fomc',
            'federal reserve',
            'nonfarm payrolls',
            'payrolls',
            'jobs report',
            'unemployment',
            'jobless claims',
          ];
    const macroKeywords =
      market === 'KR'
        ? [
            '코스피',
            '코스닥',
            '증시',
            '유가',
            '원유',
            '반도체',
            '2차전지',
            '수급',
            '지정학',
            '정책',
            '중국',
            '미국장',
          ]
        : [
            'treasury',
            'yield',
            'bond',
            'dollar',
            'oil',
            'wti',
            'brent',
            'geopolitical',
            'iran',
            'israel',
            'tariff',
            'policy',
            'credit',
            'volatility',
            'risk-off',
            'risk on',
          ];
    const lowValueKeywords = [
      'best stocks',
      'buy now',
      'prediction',
      'forecast',
      'millionaire',
      'dividend stocks',
      'etf',
    ];

    let score = 0;
    coreKeywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        score += 5;
      }
    });
    macroKeywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        score += 2;
      }
    });
    lowValueKeywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        score -= 2;
      }
    });

    return score;
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

    for (const page of [1, 2, 3, 4, 5, 6, 7, 8]) {
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
      if (news.length >= 60) {
        break;
      }
    }

    if (news.length < 60) {
      const searchGroups = await Promise.all([
        this.getNaverSearchNews('코스피 코스닥 증시').catch(() => [] as MarketNews[]),
        this.getNaverSearchNews('한국 증시 마감').catch(() => [] as MarketNews[]),
        this.getNaverSearchNews('반도체 2차전지 증시').catch(() => [] as MarketNews[]),
      ]);
      news.push(...searchGroups.flat());
    }

    const byUrl = new Map<string, MarketNews>();
    news.forEach((item) => {
      if (item.url && !byUrl.has(item.url)) {
        byUrl.set(item.url, item);
      }
    });

    return [...byUrl.values()].sort((a, b) => b.datetime - a.datetime).slice(0, 60);
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

    const sources = news.slice(0, 24).map((item) => ({
      headline: item.translatedHeadline || item.headline,
      source: item.source,
      summary: item.summary,
      url: item.url,
      datetime: item.datetime,
    }));
    const pulseLines = pulse
      .filter((item) =>
        market === 'US'
          ? !item.symbol.startsWith('KIS_')
          : item.symbol.startsWith('KIS_'),
      )
      .slice(0, 8)
      .map(
        (item) =>
          `${item.name ?? item.symbol}: ${item.current} (${item.change}, ${item.percentChange}%)`,
      );
    const targetLanguage = language.toLowerCase() === 'en' ? 'English' : 'Korean';
    const reportScope =
      market === 'KR'
        ? '한국 개인투자자가 오늘 장 마감 후 확인하는 당일 한국 주식 요약입니다.'
        : '한국 개인투자자가 출근길에 확인하는 전일 미국 주식 요약입니다.';

    const effectiveReportScope =
      market === 'KR'
        ? '한국 개인투자자가 오늘 장 마감 후 확인하는 당일 한국장 요약입니다.'
        : '한국 개인투자자가 출근길에 확인하는 전일 미국장 요약입니다.';
    const companyNewsPrompt = [
      '중요: companyNews는 반드시 OpenAI가 제공된 News를 분석해서 직접 작성한 주요 종목/기업 뉴스 배열이어야 한다.',
      'companyNews에는 참고 뉴스 원문 목록을 그대로 복사하지 말고, 제공된 News 안에서 실제로 중요한 기업/종목 이슈만 선별해서 5~10개 작성해라.',
      '각 companyNews 항목은 반드시 {"symbol":"티커", "name":"종목명 #티커", "headline":"한 줄 제목", "lines":["본문 1","본문 2"]} 구조로 작성해라.',
      'symbol에는 #을 빼고 NVDA, TSLA, 005930 같은 티커만 넣어라.',
      'name 또는 headline에는 사용자가 클릭할 수 있도록 종목명 옆에 #티커와 숫자형 (%등락률)를 포함해라. 예: "Nvidia #NVDA (+2.15%)", "삼성전자 #005930 (-1.02%)".',
      '등락률은 반드시 (+1.23%) 또는 (-1.23%)처럼 부호와 숫자와 %만 써라. "-5%대", "(%등락률 미제공)", "(미제공)" 같은 표현은 절대 쓰지 마라.',
      '제공된 데이터에서 해당 종목의 정확한 등락률을 확인할 수 없으면 등락률 괄호를 아예 쓰지 말고 "Nvidia #NVDA"처럼 #티커까지만 써라.',
      '각 종목 뉴스는 2~5줄로 작성하고, "무슨 일이 있었고 -> 시장이 왜 주목했고 -> 관련 업종이나 투자심리에 어떤 의미가 있었는지"의 흐름으로 작성해라.',
      '미국장 리포트에서는 대형 기술주, 반도체, 전기차, 금융, 헬스케어, 소비재, 에너지, 산업재, 방산, 중국 ADR 등 여러 업종이 함께 보이도록 균형 있게 선택해라.',
      'Nvidia #NVDA, Tesla #TSLA 같은 종목은 제공된 News에 실제 관련 뉴스가 있고 전일 시장 영향도가 클 때만 포함해라.',
      'ETF 뉴스는 개별 기업 뉴스보다 우선순위를 낮춰라.',
      'JSON 필드명은 반드시 companyNews를 사용해라.',
    ].join('\n');

  type NewsSource = {
  headline?: string;
  source?: string;
  summary?: string;
  description?: string;
  publishedAt?: string;
  url?: string;
};

function normalizeText(value?: string): string {
  return (value || '').toLowerCase();
}

function sourceToSearchText(item: NewsSource): string {
  return [
    item.headline,
    item.summary,
    item.description,
    item.source,
    item.publishedAt,
  ]
    .filter(Boolean)
    .join(' ');
}

function hasAnyKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => {
    const escaped = keyword
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\ /g, '\\s+');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(lower);
  });
}

/**
 * CPI/PCE/FOMC/고용처럼 "발표된 날에는 매크로 상단에서 반드시 검토해야 하는 이벤트"만 추출.
 * 발표 없는 날은 빈 배열이므로 CPI를 억지로 쓰지 않음.
 */
function buildHighPriorityMacroLines(sources: NewsSource[]): string[] {
  const highPriorityKeywords = [
    'cpi',
    'core cpi',
    'consumer price index',
    'inflation data',
    'pce',
    'core pce',
    'personal consumption expenditures',
    'fomc',
    'federal reserve',
    'rate decision',
    'dot plot',
    'nonfarm payrolls',
    'payrolls',
    'jobs report',
    'unemployment',
    'jobless claims',
    'wage growth',
    'average hourly earnings',
    'ppi',
    'producer price index',
  ];

  const highPrioritySources = sources.filter((item) => {
    const text = sourceToSearchText(item);
    return hasAnyKeyword(text, highPriorityKeywords);
  });

  return highPrioritySources.slice(0, 5).map((item, index) => {
    return [
      `${index + 1}. ${item.headline || 'No headline'} (${item.source || 'Unknown source'})`,
      item.summary ? `Summary: ${item.summary}` : '',
      item.description ? `Description: ${item.description}` : '',
      item.publishedAt ? `Published: ${item.publishedAt}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  });
}

/**
 * 일반 매크로 뉴스 후보.
 * 지정학, 유가, 금리, 달러, 원자재, 정책, 수급 등.
 * 단, High priority와 겹칠 수 있으므로 모델에게 우선순위는 따로 지시함.
 */
function buildMacroEventLines(sources: NewsSource[]): string[] {
  const macroKeywords = [
    'oil',
    'wti',
    'brent',
    'crude',
    'treasury',
    'yield',
    'bond',
    'dollar',
    'currency',
    'yen',
    'won',
    'gold',
    'commodity',
    'commodities',
    'geopolitical',
    'iran',
    'israel',
    'china',
    'tariff',
    'export control',
    'sanction',
    'opec',
    'policy',
    'central bank',
    'liquidity',
    'volatility',
    'risk-off',
    'risk on',
    'credit',
    'debt',
    'fiscal',
  ];

  const macroSources = sources.filter((item) => {
    const text = sourceToSearchText(item);
    return hasAnyKeyword(text, macroKeywords);
  });

  return macroSources.slice(0, 8).map((item, index) => {
    return [
      `${index + 1}. ${item.headline || 'No headline'} (${item.source || 'Unknown source'})`,
      item.summary ? `Summary: ${item.summary}` : '',
      item.description ? `Description: ${item.description}` : '',
      item.publishedAt ? `Published: ${item.publishedAt}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  });
}

function buildNewsText(sources: NewsSource[]): string {
  if (!sources.length) return 'No news.';

  return sources
    .map((item, index) =>
      [
        `${index + 1}. ${item.headline || 'No headline'} (${item.source || 'Unknown source'})`,
        item.summary ? `Summary: ${item.summary}` : '',
        item.description ? `Description: ${item.description}` : '',
        item.publishedAt ? `Published: ${item.publishedAt}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

const typedSources = sources as NewsSource[];

const highPriorityMacroLines = buildHighPriorityMacroLines(typedSources);
const macroEventLines = buildMacroEventLines(typedSources);
const newsText = buildNewsText(typedSources);

const response = await this.fetchOpenAiWithRetry(
  'https://api.openai.com/v1/responses',
  {
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
          content: [
            'You are a market close report writer for Korean retail investors.',
            'Use only the Market indicators, Core macro event candidates, Macro events, and News provided by the user.',
            'Core macro event candidates are not mandatory every day.',
            'If Core macro event candidates are provided, they must be reviewed before ordinary News.',
            'If CPI, Core CPI, PCE, FOMC, Fed, or labor-market data appears in Core macro event candidates, it must not be omitted from macroLines.',
            'Market indicators are results, not causes. Do not treat index moves as macro causes.',
            'In macroLines, do not write absence statements such as "not included", "not provided", "not confirmed", or "no data"; silently omit unsupported topics instead.',
            'Do not invent facts, prices, dates, quotes, company statements, or market moves.',
            'Do not mention internal input section names such as Core macro event candidates, Macro events, High priority, or Priority note in the final Korean report.',
            'If the market was closed, return exactly "휴장이었습니다." and nothing else.',
            'Otherwise, return only valid JSON. Do not include markdown fences or extra commentary.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            companyNewsPrompt,

            `Market: ${market}`,
            `Language: ${targetLanguage}`,
            `Report scope: ${effectiveReportScope}`,

            [
              '기본 역할:',
              '너는 한국 개인투자자를 위한 장 마감 리포트 작성자다.',
              '아래 제공된 Market indicators, Core macro event candidates, Macro events, News만 근거로 사용해라.',
              '제공되지 않은 사실, 주가, 날짜, 기업 발언, 시장 반응은 절대 추측하지 마라.',
              '투자 권유 표현은 피하고, 정보 전달 중심으로 작성해라.',
              '모든 문장은 존댓말 문체로 작성해라.',
              '"~했다", "~강조했다", "~전망했다"가 아니라 "~했습니다", "~강조했습니다", "~전망했습니다"처럼 끝내라.',
              '제목은 본문 날짜 기준으로 [M월 D일] 제목 형식이어야 한다.',
              '종목 표기는 괄호 없이 "삼성전자 #005930", "Nvidia #NVDA" 형식으로 작성해라.',
              '등락률이 제공된 경우에만 종목명 뒤에 숫자형 등락률을 붙여라. 예: "Nvidia #NVDA (+2.15%)", "삼성전자 #005930 (-1.02%)".',
              '등락률이 제공되지 않았으면 등락률을 절대 만들지 마라.',
              '미국장 리포트는 전일 미국장 요약이고, 한국장 리포트는 당일 한국장 요약이다.',
              '전일 미국장이 휴장이었거나 금일 한국장이 휴장이었으면 다른 JSON을 쓰지 말고 정확히 "휴장이었습니다."만 출력해라.',
              '뉴스 제목뿐 아니라 Summary 또는 Description이 제공된 경우, 그 안의 구체적 내용을 우선 활용해라.',
              '단, Summary 또는 Description에 없는 세부 발언이나 사건 내용은 추측하지 마라.',
              '중요: 이 프롬프트 안에 깨진 한글(mojibake)이 보이면 모두 무시하고, 정상 한국어 지시문만 따라라.',
            ].join('\n'),

            `Market indicators:\n${pulseLines.join('\n') || 'No indicator data.'}`,

            `Core macro event candidates:\n${
              highPriorityMacroLines.length
                ? highPriorityMacroLines.join('\n\n')
                : 'No core macro event candidate data.'
            }`,

            `Macro events:\n${
              macroEventLines.length
                ? macroEventLines.join('\n\n')
                : 'No macro event data.'
            }`,

            `News:\n${newsText}`,

            [
              '출력 형식:',
              '휴장이 아닌 경우에는 JSON만 출력해라.',
              '마크다운 코드블록은 쓰지 마라.',
              'JSON 필드는 반드시 다음 7개만 사용해라:',
              'titleCandidates, title, summaryLines, macroLines, companyNews, keywords, watchPoints',
              '',
              '필드별 요구사항:',
              '1. titleCandidates는 게시글 제목 후보 3개로 작성해라.',
              '2. title은 titleCandidates 중 가장 좋은 제목 1개를 선택해라.',
              '3. summaryLines는 시장 전체 요약을 정확히 5줄로 작성해라.',
              '4. macroLines는 매크로 점검을 8~12줄로 작성하되, 근거가 부족하면 5~8줄로 작성해라.',
              '5. companyNews는 전일 주요 종목/기업 뉴스 5~10개로 작성해라.',
              '6. companyNews 각 항목의 lines는 2~5줄로 작성해라.',
              '7. keywords는 오늘의 핵심 키워드 3~5개로 작성해라.',
              '8. watchPoints는 마지막 단기 관전 포인트 2~3줄로 작성해라.',
              '9. PNG 그림은 별도 이미지 생성 API에서 만들 예정이므로 JSON에는 넣지 마라.',
              '10. 휴장일이면 JSON을 출력하지 말고 "휴장이었습니다."만 출력해라.',
            ].join('\n'),

            [
              '매크로 점검 작성 규칙:',
              '',
              '핵심 원칙:',
              'macroLines는 전일 시장을 움직인 원인 이벤트와 매크로 배경을 설명하는 구간이다.',
              'Market indicators는 시장 결과값이며, 원인으로 해석하지 마라.',
              '지수 등락률, 금 가격, 비트코인 가격, 이더리움 가격, 원자재 가격 변화는 원인이 아니라 결과로 간주해라.',
              '자산 가격 변화는 원인 설명을 보조할 때만 제한적으로 언급해라.',
              'summaryLines에서 이미 다룬 나스닥, S&P 500, 다우, 코스피, 코스닥 등의 단순 등락률을 macroLines에서 반복하지 마라.',
              '',
              '우선순위 규칙:',
              'macroLines 작성 시 근거 검토 순서는 반드시 다음 순서를 따른다.',
              '1. Core macro event candidates',
              '2. Macro events',
              '3. News 중 매크로 관련 뉴스',
              '4. Market indicators는 결과 확인용',
              '5. 개별 기업 뉴스는 원칙적으로 companyNews에서 처리',
              '',
              'Core macro event candidates 처리 규칙:',
              'Core macro event candidates는 매일 반드시 존재하는 항목이 아니다.',
              'Core macro event candidates가 "No core macro event candidate data."이면 CPI, PCE, FOMC, 고용지표를 억지로 언급하지 마라.',
              '반대로 Core macro event candidates에 CPI, Core CPI, PCE, Core PCE, FOMC, Fed, 고용지표, 실업률, 임금상승률, 실업수당청구건수 같은 항목이 제공되면 해당 항목을 일반 뉴스보다 먼저 검토해라.',
              'Core macro event candidates에 CPI 또는 Core CPI가 제공되어 있으면, 해당 CPI/Core CPI가 전일 시장 해석에 어떤 의미였는지 macroLines 상단에서 반드시 다뤄라.',
              'Core macro event candidates에 CPI가 제공되어 있는데 macroLines에서 CPI를 완전히 생략하지 마라.',
              'Core macro event candidates에 있는 핵심 이벤트보다 지정학, AI, 개별 기업 뉴스, ETF 뉴스가 먼저 나오지 않도록 해라.',
              '최종 문장에는 "Core macro event candidates", "Macro events", "High priority", "Priority note" 같은 내부 분류명을 절대 쓰지 마라.',
              '단, CPI/Core CPI의 실제치, 예상치, 이전치, 발표일, 시장 반응이 제공되지 않았다면 절대 숫자나 반응을 만들지 말고 제공된 내용만 사용해라.',
              '',
              '매크로 뉴스 선별 규칙:',
              'News에 CPI, PCE, FOMC, Fed, 고용, 금리, 국채금리, 달러, 환율, 유가, 원자재, 지정학, 정책, 재정, 신용위험, 변동성, 투자심리 관련 뉴스가 있으면 매크로 후보로 검토해라.',
              '단, News에 있는 키워드만 보고 추측하지 말고, headline, summary, description에 실제 근거가 있는 경우에만 작성해라.',
              '근거가 없거나 시장 영향이 확인되지 않은 항목은 언급하지 마라.',
              '전일 CPI 관련 데이터나 뉴스가 제공되지 않았으면 CPI를 쓰지 마라.',
              '',
              '개별 기업 뉴스 처리 규칙:',
              '개별 기업 실적, 제품, 계약, 소송, 주가 반응은 원칙적으로 companyNews에서 다뤄라.',
              '다만 개별 기업 뉴스가 업종 전체 투자심리나 지수 방향성에 영향을 준 경우에는 업종 단위로만 macroLines에 연결해라.',
              '예: "반도체 업종", "대형 기술주", "AI 인프라", "전기차 업종", "은행주"처럼 시장 단위로 설명해라.',
              '',
              '작성 분량:',
              'macroLines는 원칙적으로 8~12줄로 작성해라.',
              '단, 제공된 Core macro event candidates, Macro events, 매크로 관련 News가 부족하면 5~8줄로 줄여라.',
              '근거가 부족한데 줄 수를 채우기 위해 지수 등락률, 금, 코인, 개별 종목 뉴스를 반복하지 마라.',
              '',
              '작성 방식:',
              '각 macroLines 문장은 "원인 이벤트 또는 원인 뉴스 -> 시장이 해석한 의미 -> 영향을 받은 자산군/업종" 순서로 작성해라.',
              '문장 비중은 원인 설명 70%, 시장 반응 설명 30%로 작성해라.',
              '',
              '금지 예시:',
              '"나스닥이 1.98% 하락하며 S&P 500과 다우보다 더 부진했습니다."',
              '"S&P 500은 1.62% 하락해 기술주 약세가 지수 전반으로 확산됐습니다."',
              '"다우존스는 1.87% 하락했습니다."',
              '"비트코인은 0.55%, 이더리움은 0.44% 상승했습니다."',
            ].join('\n'),

            [
              '주요 종목/기업 뉴스 선정 규칙:',
              'companyNews는 제공된 News 안에서 실제로 중요한 기업/종목 이슈만 선별해서 작성해라.',
              '단순히 시가총액이 크거나 유명하다는 이유만으로 Nvidia #NVDA, Tesla #TSLA, Apple #AAPL, Microsoft #MSFT 같은 대형 기술주를 반복해서 선택하지 마라.',
              '',
              '선정 기준은 다음 순서로 판단해라.',
              '1. 전일 주가지수 또는 업종 흐름에 영향을 준 기업 뉴스',
              '2. 실적, 가이던스, 규제, 인수합병, 공급계약, 제품 출시, 소송, 정책 영향처럼 구체적 이벤트가 있는 뉴스',
              '3. 특정 업종 전체의 투자심리나 수급에 영향을 준 대표 기업 뉴스',
              '4. 한국 개인투자자가 관심을 가질 만한 글로벌 주도 업종 뉴스',
              '5. 단순 주가 등락보다 원인과 파급효과가 명확한 뉴스',
              '',
              '미국장 리포트에서는 대형 기술주, 반도체, 전기차, 금융, 헬스케어, 소비재, 에너지, 산업재, 방산, 중국 ADR 등 여러 업종이 함께 보이도록 균형 있게 선택해라.',
              '한 업종에 뉴스가 몰려 있더라도 같은 업종 뉴스만 반복하지 말고, 시장 흐름을 설명하는 데 필요한 경우에만 집중해서 다뤄라.',
              'Nvidia #NVDA, Tesla #TSLA 같은 종목은 제공된 News에 실제 관련 뉴스가 있고 전일 시장 영향도가 클 때만 포함해라.',
              '제공된 News에 명확한 근거가 없으면 유명 종목이라도 넣지 마라.',
              '동일 리포트 안에서 Magnificent 7 종목은 최대 3개까지만 포함해라. 단, 제공된 News 대부분이 Magnificent 7 관련 뉴스인 경우에만 예외로 해라.',
              'ETF 뉴스는 개별 기업 뉴스보다 우선순위를 낮춰라.',
              '다만 ETF 뉴스가 업종 수급이나 시장 전체 흐름을 설명하는 핵심 근거일 때만 제한적으로 활용해라.',
              '근거 있는 기업 뉴스가 5개 미만이면 억지로 5개를 채우지 말고, 제공된 근거 안에서만 작성해라.',
              '',
              '각 companyNews 항목은 "무슨 일이 있었고 -> 시장이 왜 주목했고 -> 관련 업종이나 투자심리에 어떤 의미가 있었는지"의 흐름으로 작성해라.',
              '각 companyNews.lines는 2~5줄로 작성해라.',
            ].join('\n'),

            [
              'JSON Schema:',
              '{',
              '  "titleCandidates": ["string", "string", "string"],',
              '  "title": "string",',
              '  "summaryLines": ["string", "string", "string", "string", "string"],',
              '  "macroLines": ["5~12 strings"],',
              '  "companyNews": [',
              '    {',
              '      "symbol": "string",',
              '      "name": "string",',
              '      "headline": "string",',
              '      "lines": ["2~5 strings"]',
              '    }',
              '  ],',
              '  "keywords": ["3~5 strings"],',
              '  "watchPoints": ["2~3 strings"]',
              '}',
              '',
              'companyNews.symbol은 가능한 경우 "NVDA", "005930"처럼 #을 제외한 티커만 작성해라.',
              '티커가 제공되지 않았거나 확실하지 않으면 symbol은 빈 문자열로 둬라.',
              'companyNews.name은 종목명 또는 회사명만 작성해라.',
              'companyNews.headline과 lines에서 종목명을 언급할 때는 가능한 경우 "Nvidia #NVDA" 형식을 사용해라.',
            ].join('\n'),
          ].join('\n\n'),
        },
      ],
      max_output_tokens: 5000,
    }),
  },
  120_000,
  300_000,
);

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
    const parsedRecord = parsed as typeof parsed & {
      company_news?: unknown;
    };
    const companyNewsInput =
      parsedRecord.companyNews ?? parsedRecord.company_news;
    return {
      titleCandidates: parsed.titleCandidates,
      market,
      title: parsed.title,
      summary: (parsed.summaryLines ?? []).join('\n\n'),
      summaryLines: parsed.summaryLines ?? [],
      macroLines: this.cleanBriefingMacroLines(parsed.macroLines ?? []),
      companyNews: this.normalizeBriefingCompanyNews(companyNewsInput),
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
        const lines = Array.isArray(record.lines)
          ? record.lines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
          : [];
        const headline =
          typeof record.headline === 'string'
            ? record.headline
            : typeof record.summary === 'string'
              ? record.summary
              : lines[0] ?? '';
        const symbol = this.extractBriefingTicker(
          [
            typeof record.symbol === 'string' ? record.symbol : '',
            typeof record.name === 'string' ? record.name : '',
            headline,
            ...lines,
          ].join(' '),
        );
        const name = typeof record.name === 'string' ? record.name : symbol;
        const fallbackLine =
          typeof record.description === 'string'
            ? record.description
            : headline;

        return {
          symbol,
          name,
          headline,
          lines: lines.length ? lines : fallbackLine ? [fallbackLine] : [],
        };
      })
      .filter((item) => item.name || item.headline || item.lines.length);
  }

  private cleanBriefingLines(value: unknown[]): string[] {
    return value
      .filter((line): line is string => typeof line === 'string')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private cleanBriefingMacroLines(value: unknown[]): string[] {
    return this.cleanBriefingLines(value).filter(
      (line) => !this.isBriefingAbsenceLine(line),
    );
  }

  private isBriefingAbsenceLine(line: string): boolean {
    const lower = line.toLowerCase();
    const absencePatterns = [
      'not included',
      'not provided',
      'not confirmed',
      'no data',
      'no core macro',
      'core macro event candidates',
      'macro events',
      'high priority',
      'priority note',
    ];
    const koreanAbsencePatterns = [
      '제공 자료',
      '제공된 자료',
      '제공되지',
      '포함되지',
      '확인되지',
      '근거는 없',
      '근거가 없',
      '자료에는',
      '데이터는 없',
      '데이터가 없',
      '없었습니다',
      '없었고',
    ];

    return (
      absencePatterns.some((pattern) => lower.includes(pattern)) ||
      koreanAbsencePatterns.some((pattern) => line.includes(pattern))
    );
  }

  private async enrichBriefingCompanyNewsChanges(
    market: 'US' | 'KR',
    companyNews: MarketBriefing['companyNews'],
  ): Promise<MarketBriefing['companyNews']> {
    const changePattern = /\([+-]\s*\d+(?:\.\d+)?%\)/;

    return Promise.all(
      companyNews.map(async (item) => {
        const symbol = item.symbol?.trim().toUpperCase();
        if (!symbol || changePattern.test(`${item.name} ${item.headline}`)) {
          return item;
        }

        const quote = await this.getStockQuote(symbol, market).catch((error) => {
          this.logger.warn(
            `Briefing quote enrichment skipped for ${symbol}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
          return null;
        });
        const percentChange = quote?.percentChange;
        if (typeof percentChange !== 'number' || !Number.isFinite(percentChange)) {
          return item;
        }

        const formattedChange = `(${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%)`;

        return {
          ...item,
          name: this.appendBriefingChange(item.name, symbol, formattedChange),
          headline: this.appendBriefingChange(item.headline, symbol, formattedChange),
        };
      }),
    );
  }

  private appendBriefingChange(value: string, symbol: string, change: string): string {
    if (!value) {
      return `#${symbol} ${change}`;
    }

    const tickerPattern = new RegExp(`(#${this.escapeRegExp(symbol)})(?!\\s*\\()`, 'i');
    if (tickerPattern.test(value)) {
      return value.replace(tickerPattern, `$1 ${change}`);
    }

    return `${value} ${change}`;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private extractBriefingTicker(value: string): string {
    const text = value.trim();
    if (!text) {
      return '';
    }

    const tagged = text.match(/#([A-Z0-9.]{1,12}|\d{6})/i)?.[1];
    if (tagged) {
      return tagged.toUpperCase();
    }

    const clean = text.replace(/^#/, '').trim().toUpperCase();
    return /^[A-Z0-9.]{1,12}$/.test(clean) || /^\d{6}$/.test(clean)
      ? clean
      : '';
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
      this.configService.get<string>('OPENAI_SVG_MODEL')?.trim() ||
      this.configService.get<string>('OPENAI_MODEL')?.trim() ||
      'gpt-5.5';
    if (!apiKey) {
      return this.toSvgDataUrl(
        this.buildMarketBriefingSvg(market, title, keywords, summaryLines),
      );
    }

    try {
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
              content: [
                'You create clean SVG editorial cover art for financial market reports.',
                'Return only valid standalone SVG markup. Do not wrap it in markdown fences.',
                'Do not use external images, web fonts, scripts, animation, foreignObject, or embedded raster images.',
              ].join('\n'),
            },
            {
              role: 'user',
              content: [
                'Create a polished 16:9 SVG cover image for a Korean retail investor market close report.',
                'Canvas must be viewBox="0 0 1440 810".',
                'Style: premium financial PPT cover, clean dashboard composition, dark navy and white surfaces, subtle green/red market accents, professional layout.',
                'Use only vector shapes: panels, abstract line charts, candlestick-like bars, arrows, soft grid lines, and simple finance icons.',
                'Short English labels are allowed if they improve the editorial design, such as MARKET BRIEF, MACRO, RISK, MOMENTUM, CLOSE, WATCH, FLOW, TECH, ENERGY, or POLICY.',
                'Do not render Korean text, article titles, ticker labels, prices, percentages, dates, company names, logos, or long readable sentences inside the SVG because generated text can break.',
                'Keep any English text large, sparse, and decorative; avoid paragraphs, tiny text, dense tables, and fake dashboards full of numbers.',
                'Keep important visual elements inside the central safe area so the image works as a web article banner without cropping.',
                'Avoid clutter, tiny text, fake logos, overloaded numbers, comic style, neon cyberpunk, or sensational news graphics.',
                `Market: ${market}`,
                `Title context, do not render as text: ${title}`,
                `Visual keywords, do not render as text: ${keywords.join(', ')}`,
                `Facts only for visual mood, do not render as text: ${summaryLines.slice(0, 5).join(' / ')}`,
              ].join('\n'),
            },
          ],
          max_output_tokens: 3500,
        }),
      }, 120_000, 300_000);

      if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new ServiceUnavailableException(
          `OpenAI SVG request failed: ${message || response.status}`,
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
      const svg = this.extractSvgMarkup(outputText ?? '');

      if (svg) {
        return this.toSvgDataUrl(svg);
      }

      this.logger.warn('OpenAI SVG response was not valid SVG; using local SVG fallback.');
    } catch (error) {
      this.logger.warn(
        `OpenAI SVG generation failed; using local SVG fallback: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    return this.toSvgDataUrl(
      this.buildMarketBriefingSvg(market, title, keywords, summaryLines),
    );
  }

  private extractSvgMarkup(value: string): string {
    const text = value.trim();
    const start = text.indexOf('<svg');
    const end = text.lastIndexOf('</svg>');

    if (start < 0 || end < start) {
      return '';
    }

    const svg = text.slice(start, end + '</svg>'.length).trim();
    return svg.includes('<script') || svg.includes('<foreignObject') ? '' : svg;
  }

  private toSvgDataUrl(svg: string): string {
    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  }

  private buildMarketBriefingSvg(
    market: 'US' | 'KR',
    title = '',
    keywords: string[] = [],
    summaryLines: string[] = [],
  ): string {
    const seed = this.hashString(
      [market, title, ...keywords, ...summaryLines.slice(0, 3)].join('|'),
    );
    const palette =
      market === 'KR'
        ? [
            ['#22c55e', '#f97316', '#ef4444'],
            ['#14b8a6', '#84cc16', '#f59e0b'],
            ['#16a34a', '#38bdf8', '#fb7185'],
          ]
        : [
            ['#38bdf8', '#22c55e', '#ef4444'],
            ['#60a5fa', '#a78bfa', '#f97316'],
            ['#2dd4bf', '#818cf8', '#f43f5e'],
          ];
    const [accent, secondary, danger] = palette[seed % palette.length];
    const variant = seed % 4;
    const label = market === 'KR' ? 'KOREA CLOSE' : 'US CLOSE';
    const panelLabel = market === 'KR' ? 'SEOUL FLOW' : 'WALL ST FLOW';
    const keywordLabels = (keywords.length ? keywords : ['MACRO', 'RISK', 'WATCH'])
      .map((keyword) => keyword.replace(/[^a-zA-Z0-9 ]/g, '').trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 3);
    const bars = Array.from({ length: 9 }, (_, index) => {
      const x = 210 + index * 62;
      const height = 70 + ((seed >> (index % 12)) % 190);
      const y = 610 - height;
      const color = (index + variant) % 3 === 0 ? danger : (index + variant) % 2 === 0 ? accent : secondary;
      return `<rect x="${x}" y="${y}" width="30" height="${height}" rx="9" fill="${color}" opacity="${0.58 + (index % 3) * 0.12}"/>`;
    }).join('');
    const chartPath =
      variant === 0
        ? 'M190 585 C300 500,380 555,470 430 S650 310,760 350 S950 420,1130 220'
        : variant === 1
          ? 'M190 520 C310 610,400 470,520 500 S710 310,850 365 S1010 245,1145 295'
          : variant === 2
            ? 'M190 610 C310 560,405 470,520 515 S710 570,830 430 S1010 255,1140 210'
            : 'M190 560 C320 435,420 455,540 355 S725 425,835 300 S1015 380,1140 230';
    const rightCards =
      variant % 2 === 0
        ? [
            '<rect x="845" y="440" width="360" height="78" rx="18" fill="#0f172a" stroke="#334155" stroke-width="2"/>',
            '<rect x="845" y="542" width="300" height="78" rx="18" fill="#0f172a" stroke="#334155" stroke-width="2"/>',
            `<circle cx="885" cy="479" r="15" fill="${accent}"/>`,
            `<circle cx="885" cy="581" r="15" fill="${danger}"/>`,
            '<path d="M925 480h230M925 582h170" stroke="#94a3b8" stroke-width="12" stroke-linecap="round" opacity="0.45"/>',
          ]
        : [
            '<rect x="835" y="198" width="370" height="92" rx="22" fill="#f8fafc" opacity="0.08" stroke="#475569" stroke-width="2"/>',
            '<rect x="895" y="332" width="300" height="92" rx="22" fill="#f8fafc" opacity="0.06" stroke="#475569" stroke-width="2"/>',
            `<path d="M875 246h72M875 266h180" stroke="${accent}" stroke-width="12" stroke-linecap="round" opacity="0.85"/>`,
            `<path d="M935 380h72M935 400h140" stroke="${secondary}" stroke-width="12" stroke-linecap="round" opacity="0.85"/>`,
          ];

    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 810" role="img">',
      '<defs>',
      '<linearGradient id="bg" x1="0" y1="0" x2="1440" y2="810" gradientUnits="userSpaceOnUse">',
      '<stop stop-color="#07111f"/>',
      '<stop offset="0.54" stop-color="#101827"/>',
      '<stop offset="1" stop-color="#172033"/>',
      '</linearGradient>',
      '<linearGradient id="panel" x1="160" y1="120" x2="1280" y2="690" gradientUnits="userSpaceOnUse">',
      '<stop stop-color="#f8fafc" stop-opacity="0.12"/>',
      '<stop offset="1" stop-color="#f8fafc" stop-opacity="0.04"/>',
      '</linearGradient>',
      `<linearGradient id="line" x1="220" y1="610" x2="1180" y2="190" gradientUnits="userSpaceOnUse"><stop stop-color="${secondary}"/><stop offset="1" stop-color="${accent}"/></linearGradient>`,
      `<radialGradient id="halo" cx="${variant % 2 ? '35%' : '78%'}" cy="${variant > 1 ? '28%' : '72%'}" r="55%"><stop stop-color="${accent}" stop-opacity="0.24"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>`,
      '<filter id="glow"><feGaussianBlur stdDeviation="10" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
      '</defs>',
      '<rect width="1440" height="810" fill="url(#bg)"/>',
      '<rect width="1440" height="810" fill="url(#halo)"/>',
      '<g opacity="0.18">',
      '<path d="M120 170h1200M120 290h1200M120 410h1200M120 530h1200M120 650h1200" stroke="#94a3b8" stroke-width="1"/>',
      '<path d="M220 110v590M420 110v590M620 110v590M820 110v590M1020 110v590M1220 110v590" stroke="#94a3b8" stroke-width="1"/>',
      '</g>',
      '<rect x="120" y="105" width="1200" height="600" rx="32" fill="url(#panel)" stroke="#334155" stroke-width="2"/>',
      `<circle cx="${variant % 2 ? 310 : 1160}" cy="${variant > 1 ? 210 : 625}" r="170" fill="${accent}" opacity="0.08"/>`,
      `<circle cx="${variant % 2 ? 1130 : 280}" cy="${variant > 1 ? 630 : 190}" r="190" fill="${secondary}" opacity="0.07"/>`,
      `<text x="160" y="176" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" letter-spacing="4">${label}</text>`,
      `<text x="164" y="218" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" letter-spacing="3">${panelLabel}</text>`,
      '<g opacity="0.95">',
      bars,
      '</g>',
      `<path d="${chartPath}" fill="none" stroke="url(#line)" stroke-width="18" stroke-linecap="round" filter="url(#glow)"/>`,
      variant % 2 === 0
        ? '<path d="M1130 220 L1060 228 M1130 220 L1102 286" stroke="url(#line)" stroke-width="18" stroke-linecap="round"/>'
        : '<circle cx="1145" cy="295" r="20" fill="url(#line)" filter="url(#glow)"/>',
      '<g opacity="0.92">',
      ...rightCards,
      '</g>',
      '<g transform="translate(150 150)">',
      `<rect width="250" height="74" rx="22" fill="#0f172a" stroke="${accent}" stroke-width="2" opacity="0.96"/>`,
      '<path d="M42 47h146" stroke="#64748b" stroke-width="12" stroke-linecap="round" opacity="0.5"/>',
      '<path d="M42 28h86" stroke="#f8fafc" stroke-width="12" stroke-linecap="round" opacity="0.85"/>',
      '</g>',
      '<g transform="translate(160 675)">',
      ...keywordLabels.map((keyword, index) => {
        const x = index * 176;
        return `<g transform="translate(${x} 0)"><rect width="150" height="42" rx="14" fill="#0f172a" stroke="#475569" stroke-width="1.5"/><text x="75" y="27" text-anchor="middle" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="800" letter-spacing="1.6">${keyword.slice(0, 12)}</text></g>`;
      }),
      '</g>',
      '</svg>',
    ].join('');
  }

  private hashString(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private async runScheduledMarketBriefing(market: 'US' | 'KR'): Promise<void> {
    try {
      const latest = await this.marketBriefingsRepository.findOne({
        where: { market },
        order: { generatedAt: 'DESC' },
      });
      if (
        latest &&
        this.toKoreanDateKey(new Date(latest.generatedAt)) ===
          this.toKoreanDateKey(new Date())
      ) {
        this.logger.log(
          `Scheduled ${market} market briefing skipped: already generated today (${latest.id})`,
        );
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

  private toKoreanDateKey(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
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

  private async getKoreanFinancials(symbol: string): Promise<StockFinancial[]> {
    const rows = await this.stockFinancialRepository.find({
      where: { symbol },
      order: { fiscalYear: 'DESC' },
      take: 5,
    });

    return rows.map((row) => ({
      fiscalYear: row.fiscalYear,
      revenue: row.revenue,
      operatingProfit: row.operatingProfit,
      netIncome: row.netIncome,
      equity: row.equity,
      eps: row.eps,
      marketCap: row.marketCap,
      per: row.per,
      pbr: row.pbr,
      psr: row.psr,
      roe: row.roe,
      source: row.source,
      fetchedAt: row.fetchedAt,
    }));
  }

  private buildKoreanMetricsFromFinancials(
    financial: StockFinancial | null,
    output: Record<string, string | undefined>,
  ): CompanyMetrics | null {
    if (!financial) {
      return {
        '52WeekHigh': this.toOptionalNumber(
          output.w52_hgpr ?? output.stck_hgpr_52w,
        ),
        '52WeekLow': this.toOptionalNumber(
          output.w52_lwpr ?? output.stck_lwpr_52w,
        ),
        currentPrice: this.toOptionalNumber(output.stck_prpr),
      };
    }

    return {
      peTTM: financial.per,
      pbAnnual: financial.pbr,
      epsTTM: financial.eps,
      psTTM: financial.psr,
      roeTTM: financial.roe,
      dividendYieldTTM: null,
      '52WeekHigh': this.toOptionalNumber(
        output.w52_hgpr ?? output.stck_hgpr_52w,
      ),
      '52WeekLow': this.toOptionalNumber(
        output.w52_lwpr ?? output.stck_lwpr_52w,
      ),
      currentPrice: this.toOptionalNumber(output.stck_prpr),
    };
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
