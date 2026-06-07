import { create } from "zustand";
import { apiRequest } from "@/common/lib/api";
import { MarketQuote, StockSymbol, TradeTick } from "@/common/types";
import { mergePrioritySymbols } from "@/common/utils/stock-search";

type MarketDataState = {
  pulse: MarketQuote[];
  usStocks: MarketQuote[];
  usSymbols: StockSymbol[];
  krStocks: MarketQuote[];
  krSymbols: StockSymbol[];
  exchangeRate: number | null;
  extraQuotes: Record<string, MarketQuote>;
  livePrices: Record<string, TradeTick>;
  liveSeries: Record<string, TradeTick[]>;
  marketLoading: boolean;
  /** pulse/종목/심볼 일괄 로드. 부분 실패는 무시(성공분만 반영). */
  loadMarketData: (token: string) => Promise<string[]>;
  loadStockQuotes: (
    tags: Array<{ symbol: string; market: "US" | "KR" }>,
    token: string,
  ) => Promise<void>;
  /** 웹소켓 market:trade 틱 반영 (livePrices + 최근 40개 시리즈). */
  applyTrade: (tick: TradeTick) => void;
};

export const useMarketDataStore = create<MarketDataState>((set) => ({
  pulse: [],
  usStocks: [],
  usSymbols: [],
  krStocks: [],
  krSymbols: [],
  exchangeRate: null,
  extraQuotes: {},
  livePrices: {},
  liveSeries: {},
  marketLoading: false,

  loadMarketData: async (token) => {
    if (!token) {
      return [];
    }

    set({ marketLoading: true });
    try {
      const [pulseResult, usStocksResult, usSymbolsResult, krStocksResult, krSymbolsResult] =
        await Promise.allSettled([
          apiRequest<MarketQuote[]>("/markets/pulse", "GET", { accessToken: token }),
          apiRequest<MarketQuote[]>("/markets/stocks/us", "GET", { accessToken: token }),
          apiRequest<StockSymbol[]>("/markets/symbols/us", "GET", { accessToken: token }),
          apiRequest<MarketQuote[]>("/markets/stocks/kr", "GET", { accessToken: token }),
          apiRequest<StockSymbol[]>("/markets/symbols/kr", "GET", { accessToken: token }),
        ]);
      const next: Partial<MarketDataState> = {};
      if (pulseResult.status === "fulfilled") {
        next.pulse = pulseResult.value;
        const exchangeRate = pulseResult.value.find(
          (quote) => quote.symbol === "KIS_FX:USDKRW",
        )?.current;
        if (exchangeRate && exchangeRate > 0) {
          next.exchangeRate = exchangeRate;
        }
      }
      if (usStocksResult.status === "fulfilled") {
        next.usStocks = usStocksResult.value;
      }
      if (usSymbolsResult.status === "fulfilled" && usStocksResult.status === "fulfilled") {
        next.usSymbols = mergePrioritySymbols(usSymbolsResult.value, usStocksResult.value);
      }
      if (krStocksResult.status === "fulfilled") {
        next.krStocks = krStocksResult.value;
      }
      if (krSymbolsResult.status === "fulfilled" && krStocksResult.status === "fulfilled") {
        next.krSymbols = mergePrioritySymbols(krSymbolsResult.value, krStocksResult.value);
      }
      set(next);
      const subscribeSymbols = [
        ...(pulseResult.status === "fulfilled" ? pulseResult.value : []),
        ...(usStocksResult.status === "fulfilled" ? usStocksResult.value : []),
      ]
        .map((quote) => quote.symbol)
        .filter(Boolean)
        .slice(0, 24);
      return [...new Set(subscribeSymbols)];
    } catch (marketError) {
      console.error("Could not load market data", marketError);
      return [];
    } finally {
      set({ marketLoading: false });
    }
  },

  loadStockQuotes: async (tags, token) => {
    const uniqueTags = [
      ...new Map(
        tags.map((tag) => [
          `${tag.market}:${tag.symbol.toUpperCase()}`,
          { ...tag, symbol: tag.symbol.toUpperCase() },
        ]),
      ).values(),
    ];
    const results = await Promise.allSettled(
      uniqueTags.map((tag) =>
        apiRequest<MarketQuote>(
          `/markets/stocks/quote?symbol=${encodeURIComponent(tag.symbol)}&market=${tag.market}`,
          "GET",
          { accessToken: token },
        ),
      ),
    );
    set((state) => {
      const extraQuotes = { ...state.extraQuotes };
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value.current > 0) {
          extraQuotes[result.value.symbol] = result.value;
        }
      });
      return { extraQuotes };
    });
  },

  applyTrade: (tick) =>
    set((state) => ({
      livePrices: { ...state.livePrices, [tick.symbol]: tick },
      liveSeries: {
        ...state.liveSeries,
        [tick.symbol]: [...(state.liveSeries[tick.symbol] ?? []), tick].slice(-40),
      },
    })),
}));
