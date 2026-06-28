export type FinnhubQuote = {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
};

export type MarketQuote = {
  symbol: string;
  name?: string;
  currency?: 'USD' | 'KRW';
  current: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
  marketStatus?: string;
};

export type StockSymbol = {
  symbol: string;
  displaySymbol: string;
  description: string;
  type: string;
  currency?: string;
};

export type FavoriteStock = MarketQuote & {
  market: 'US' | 'KR';
  favoriteId: string;
  addedAt: string;
};

export type PortfolioPositionInput = {
  symbol?: string;
  market?: string;
  name?: string;
  quantity?: number;
  averagePrice?: number;
};

export type PortfolioInput = {
  name?: string;
  positions?: PortfolioPositionInput[];
};

export type PortfolioPosition = MarketQuote & {
  id: string;
  portfolioId: string;
  market: 'US' | 'KR';
  quantity: number;
  averagePrice: number;
  cost: number;
  value: number;
  addedAt: string;
};

export type Portfolio = {
  id: string;
  name: string;
  positions: PortfolioPosition[];
  createdAt: string;
  updatedAt: string;
};

export type CompanyProfile = {
  country?: string;
  currency?: string;
  exchange?: string;
  ipo?: string;
  marketCapitalization?: number;
  name?: string;
  phone?: string;
  shareOutstanding?: number;
  ticker?: string;
  weburl?: string;
  logo?: string;
  finnhubIndustry?: string;
};

export type CompanyMetrics = Record<string, number | string | null | undefined>;

export type StockFinancial = {
  fiscalYear: number;
  revenue: number | null;
  operatingProfit: number | null;
  netIncome: number | null;
  equity: number | null;
  eps: number | null;
  marketCap: number | null;
  per: number | null;
  pbr: number | null;
  psr: number | null;
  roe: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  source: string;
  fetchedAt: Date | null;
};

export type StockDetail = {
  symbol: string;
  isSp500?: boolean;
  profile: CompanyProfile;
  metrics: CompanyMetrics | null;
  financials?: StockFinancial[];
  nextEarnings?: UsEarningsCalendarItem | null;
  overview: {
    en: string;
    ko: string;
    source: string;
    fetchedAt: Date | null;
  };
  quote: MarketQuote;
};

export type MarketNews = {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  translatedHeadline?: string;
  url: string;
};

export type MarketBriefing = {
  id: string;
  market: 'US' | 'KR';
  title: string;
  titleCandidates: string[];
  summary: string;
  summaryLines: string[];
  macroLines: string[];
  companyNews: Array<{
    symbol: string;
    name: string;
    headline: string;
    lines: string[];
  }>;
  keywords: string[];
  watchPoints: string[];
  imageUrl: string | null;
  generatedAt: number;
  model: string;
  imageModel: string | null;
  sources: Array<{
    headline: string;
    source: string;
    url: string;
    datetime: number;
  }>;
};

export type IpoCalendarItem = {
  id: string;
  corpCode: string | null;
  corpName: string;
  stockCode: string | null;
  reportName: string;
  receiptNo: string;
  receiptDate: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  subscriptionDateText: string | null;
  listingDate: string | null;
  listingDateText: string | null;
  expectedOfferPrice: string | null;
  confirmedOfferPrice: string | null;
  underwriter: string | null;
  dartUrl: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UsEarningsCalendarItem = {
  id: string;
  symbol: string;
  companyName: string;
  reportDate: string;
  fiscalDateEnding: string | null;
  estimate: number | null;
  revenueEstimate: number | null;
  epsActual: number | null;
  revenueActual: number | null;
  actualCheckedAt: Date | null;
  estimateSource: string | null;
  actualSource: string | null;
  finnhubYear: number | null;
  finnhubQuarter: number | null;
  secConfirmedAt: Date | null;
  secFinancialId: string | null;
  currency: string | null;
  timeOfTheDay: string | null;
  stockMasterId: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ChartPeriod = '1D' | '1M' | '1Y' | '3Y' | '5Y' | 'ALL';

export type CandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
