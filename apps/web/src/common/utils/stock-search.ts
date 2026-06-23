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
    "TSM",
    "NVO",
    "ASML",
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
    currency: quote.currency ?? "USD",
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

export function stockSearchScore(item: StockSymbol, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return 0;
  }
  const symbol = (item.symbol ?? "").toLowerCase();
  const displaySymbol = (item.displaySymbol ?? item.symbol ?? "").toLowerCase();
  const name = (item.description ?? "").toLowerCase();
  const tickerCandidates = [...new Set([symbol, displaySymbol])];
  const exactTicker = tickerCandidates.find((candidate) => candidate === query);
  if (exactTicker) return 320 - exactTicker.length;
  const prefixTicker = tickerCandidates.find((candidate) => candidate.startsWith(query));
  if (prefixTicker) return 240 - prefixTicker.length;
  const nameParts = name.split(/[\s.,/&()_-]+/).filter(Boolean);
  if (nameParts.some((part) => part === query)) return 180;
  if (nameParts.some((part) => part.startsWith(query))) return 150;
  if (name.startsWith(query)) return 100;
  if (tickerCandidates.some((candidate) => candidate.includes(query))) return 90;
  if (name.includes(query)) return 80;
  const distance = editDistance(symbol, query);
  return distance <= 2 ? 70 - distance * 10 : 0;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length];
}
