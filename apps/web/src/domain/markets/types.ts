import { MarketQuote } from "@/common/types";

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
