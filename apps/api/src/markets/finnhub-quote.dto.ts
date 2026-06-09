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
};

export type StockSymbol = {
  symbol: string;
  displaySymbol: string;
  description: string;
  type: string;
  currency?: string;
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

export type StockDetail = {
  symbol: string;
  profile: CompanyProfile;
  metrics: CompanyMetrics | null;
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

export type ChartPeriod = '1D' | '1M' | '1Y' | '3Y' | '5Y' | 'ALL';

export type CandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
