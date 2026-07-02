import { MarketQuote } from "@/common/types";
import { UsEarningsCalendarItem } from "@/domain/ipo/types";

export type StockTab = "US" | "KR";

export type ChartPeriod =
  | "1D"
  | "1M"
  | "3M"
  | "6M"
  | "1Y"
  | "3Y"
  | "5Y"
  | "ALL";

export type StockDetail = {
  symbol: string;
  isSp500?: boolean;
  profile: {
    name?: string;
    exchange?: string;
    currency?: string;
    logo?: string;
    weburl?: string;
    finnhubIndustry?: string;
    marketCapitalization?: number;
    ipo?: string;
    country?: string;
    shareOutstanding?: number;
  };
  metrics: Record<string, number | string | null | undefined> | null;
  nextEarnings?: UsEarningsCalendarItem | null;
  financials?: Array<{
    fiscalYear: number;
    revenue: number | null;
    operatingProfit: number | null;
    netIncome: number | null;
    equity: number | null;
    eps: number | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    marketCap: number | null;
    per: number | null;
    pbr: number | null;
    psr: number | null;
    roe: number | null;
    source: string;
    fetchedAt: string | null;
  }>;
  overview: {
    en: string;
    ko: string;
    source: string;
    fetchedAt: string | null;
  };
  quote: MarketQuote;
};

export type UsStockFinancial = {
  fiscalYear: number;
  fiscalQuarter: number;
  periodType: "ANNUAL" | "QUARTERLY";
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  eps: number | null;
  periodStart: string | null;
  periodEnd: string;
  filedAt: string | null;
  currency: string;
  source: string;
};

export type UsStockFinancialResponse = {
  symbol: string;
  companyName: string;
  isSp500: true;
  annual: UsStockFinancial[];
  quarterly: UsStockFinancial[];
};

export type CandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MovingAveragePoint = {
  time: number;
  value: number;
};

export type CandleChart = {
  candles: CandlePoint[];
  movingAverages: Record<"20" | "50" | "120", MovingAveragePoint[]>;
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
