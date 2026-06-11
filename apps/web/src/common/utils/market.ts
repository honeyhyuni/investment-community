import { MarketQuote, TradeTick } from "@/common/types";

export function applyLiveTrade(quote: MarketQuote, tick?: TradeTick): MarketQuote {
  if (!tick) {
    return quote;
  }

  const change =
    quote.previousClose > 0 ? tick.price - quote.previousClose : quote.change;
  const percentChange =
    quote.previousClose > 0
      ? (change / quote.previousClose) * 100
      : quote.percentChange;

  return {
    ...quote,
    current: tick.price,
    change,
    percentChange,
    timestamp: Math.floor(tick.timestamp / 1000),
  };
}
