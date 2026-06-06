import { MarketQuote, StockSymbol } from "@/common/types";

/** 인기 종목 우선순위 — 심볼 리스트 정렬에 사용. */
const popularPriority = new Map(
  [
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "GOOGL",
    "META",
    "TSLA",
    "AVGO",
    "AMD",
    "NFLX",
    "COST",
    "JPM",
    "QQQ",
    "SPY",
    "DIA",
    "GLD",
    "USO",
  ].map((symbol, index) => [symbol, index] as const),
);

/** 시세에 있는 심볼을 우선 합치고, 인기순 → 알파벳순으로 정렬. */
export function mergePrioritySymbols(
  symbols: StockSymbol[],
  quotes: MarketQuote[],
): StockSymbol[] {
  const quoteSymbols = quotes.map((quote) => ({
    symbol: quote.symbol,
    displaySymbol: quote.symbol,
    description: quote.name ?? quote.symbol,
    type: "Common Stock",
    currency: "USD",
  }));
  const bySymbol = new Map<string, StockSymbol>();

  [...quoteSymbols, ...symbols].forEach((symbol) => {
    if (!bySymbol.has(symbol.symbol)) {
      bySymbol.set(symbol.symbol, symbol);
    }
  });

  return [...bySymbol.values()].sort((a, b) => {
    const priorityA = popularPriority.get(a.symbol) ?? 9999;
    const priorityB = popularPriority.get(b.symbol) ?? 9999;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.symbol.localeCompare(b.symbol);
  });
}
