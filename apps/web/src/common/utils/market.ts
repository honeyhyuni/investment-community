import { MarketQuote, TradeTick } from "@/common/types";

export function applyLiveTrade(quote: MarketQuote, tick?: TradeTick): MarketQuote {
  if (!tick) {
    return quote;
  }

  const previousClose = tick.previousClose ?? quote.previousClose;
  const change =
    tick.change ??
    (previousClose > 0 ? tick.price - previousClose : quote.change);
  const percentChange =
    tick.percentChange ??
    (previousClose > 0 ? (change / previousClose) * 100 : quote.percentChange);

  return {
    ...quote,
    current: tick.price,
    change,
    percentChange,
    previousClose,
    timestamp: Math.floor(tick.timestamp / 1000),
  };
}
