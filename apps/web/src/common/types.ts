// 도메인을 가리지 않는 공유 타입. (markets/community가 함께 쓰는 시세 타입 포함)

export type Language = "en" | "ko";

export type DisplayCurrency = "USD" | "KRW";

export type MarketQuote = {
  symbol: string;
  name?: string;
  currency?: DisplayCurrency;
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

export type TradeTick = {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
  change?: number;
  percentChange?: number;
  previousClose?: number;
};
