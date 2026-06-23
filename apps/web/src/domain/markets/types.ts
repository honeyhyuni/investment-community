import { MarketQuote } from "@/common/types";
import { UsEarningsCalendarItem } from "@/domain/ipo/types";

export type StockTab = "US" | "KR";

export type ChartPeriod = "1D" | "1M" | "1Y" | "3Y" | "5Y" | "ALL";

export type StockDetail = {
  symbol: string;
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

export type CandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
