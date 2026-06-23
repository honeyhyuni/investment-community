import { MarketQuote, StockSymbol } from "@/common/types";

/** 인기 종목 우선순위 — 심볼 리스트 정렬에 사용. */
/** Common ticker aliases for frequent user typos. */
const tickerAliases = new Map<string, string>([
  ["appl", "AAPL"],
]);

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
  const query = normalizeSearchText(rawQuery);
  if (!query) {
    return 0;
  }

  const symbol = normalizeSearchText(item.symbol ?? "");
  const displaySymbol = normalizeSearchText(item.displaySymbol ?? item.symbol ?? "");
  const name = normalizeSearchText(item.description ?? "");
  const tickerCandidates = [...new Set([symbol, displaySymbol].filter(Boolean))];
  const canonicalSymbol = (item.symbol ?? "").toUpperCase();
  if (tickerAliases.get(query) === canonicalSymbol) {
    return 700;
  }
  const tickerRank = popularPriority.get(canonicalSymbol) ?? 9999;
  const priorityBoost = tickerRank < 9999 ? Math.max(0, 24 - tickerRank) : 0;

  const exactTicker = tickerCandidates.find((candidate) => candidate === query);
  if (exactTicker) return 420 - exactTicker.length + priorityBoost;

  const prefixTicker = tickerCandidates.find((candidate) => candidate.startsWith(query));
  if (prefixTicker) return 340 - prefixTicker.length + priorityBoost;

  const nameParts = name.split(/[\s.,/&()_-]+/).filter(Boolean);
  if (nameParts.some((part) => part === query)) return 260 + priorityBoost;
  if (nameParts.some((part) => part.startsWith(query))) return 230 + priorityBoost;
  if (name.startsWith(query)) return 210 + priorityBoost;
  if (tickerCandidates.some((candidate) => candidate.includes(query))) return 190 + priorityBoost;
  if (name.includes(query)) return 170 + priorityBoost;

  const bestTickerDistance = Math.min(
    ...tickerCandidates.map((candidate) => editDistance(candidate, query)),
  );
  const isTickerTransposed = tickerCandidates.some((candidate) => isLikelyTickerTypo(candidate, query));
  if (isTickerTransposed || bestTickerDistance <= 2) {
    const fuzzyBase = tickerRank < 9999 ? 300 : 150;
    return Math.max(90, fuzzyBase - bestTickerDistance * 20 + priorityBoost);
  }

  const bestNamePartDistance = Math.min(
    ...nameParts
      .filter((part) => Math.abs(part.length - query.length) <= 2)
      .map((part) => editDistance(part, query)),
    Number.POSITIVE_INFINITY,
  );
  return bestNamePartDistance <= 1 ? 110 - bestNamePartDistance * 20 + priorityBoost : 0;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function isLikelyTickerTypo(symbol: string, query: string): boolean {
  if (symbol.length !== query.length || symbol.length < 2) {
    return false;
  }
  if ([...symbol].sort().join("") === [...query].sort().join("")) {
    return true;
  }
  for (let index = 0; index < query.length - 1; index += 1) {
    const swapped =
      query.slice(0, index) +
      query[index + 1] +
      query[index] +
      query.slice(index + 2);
    if (swapped === symbol) {
      return true;
    }
  }
  return false;
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
