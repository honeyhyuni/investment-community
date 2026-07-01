"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquareText,
  Newspaper,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  BusinessDay,
  CandlestickData,
  CandlestickSeries,
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
  Time,
} from "lightweight-charts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/common/lib/api";
import { Notice } from "@/common/components/Notice";
import { Button } from "@/common/components/Button";
import { SectionHeader } from "@/common/components/SectionHeader";
import { SegmentedControl } from "@/common/components/SegmentedControl";
import { Skeleton } from "@/common/components/Skeleton";
import { useSessionStore } from "@/common/stores/session";
import { useMarketDataStore } from "@/common/stores/market-data";
import { usePreferencesStore } from "@/common/stores/preferences";
import {
  convertMoneyValue,
  formatMoney,
  formatNumber,
} from "@/common/utils/format";
import { applyLiveTrade } from "@/common/utils/market";
import { stockSearchScore } from "@/common/utils/stock-search";
import {
  DisplayCurrency,
  FavoriteStock,
  Language,
  MarketQuote,
  StockSymbol,
  TradeTick,
} from "@/common/types";
import { CommunityPost } from "@/domain/community/types";
import { getPostHtml, htmlToPlainText } from "@/domain/community/utils";
import { useStockRouteSelection } from "@/domain/markets/hooks/useStockRouteSelection";
import {
  buildMetricItems,
  formatMarketCap,
  translateDetailLabel,
} from "@/domain/markets/utils/format";
import {
  CandlePoint,
  CandleChart,
  ChartPeriod,
  MarketNews,
  StockDetail,
  StockTab,
} from "@/domain/markets/types";

const chartPeriods: ChartPeriod[] = [
  "1D",
  "1M",
  "3M",
  "6M",
  "1Y",
  "3Y",
  "5Y",
  "ALL",
];

type RecentStock = {
  symbol: string;
  description: string;
};

const movingAverages = [
  { period: 20, color: "#2563eb" },
  { period: 50, color: "#d97706" },
  { period: 120, color: "#7c3aed" },
] as const;

const copy = {
  en: {
    translate: "한국어",
    logout: "Logout",
    stocks: "Stocks",
    news: "News",
    community: "Community",
    admin: "Admin",
    marketPulse: "Market pulse",
    refresh: "Refresh",
    stockList: "Stock list",
    stockHint: "US list is filtered to major exchanges first.",
    korea: "Korea",
    us: "United States",
    search: "Search symbol or company",
    overview: "Company overview",
    showOther: "Show Korean",
    access: "Access approvals",
  },
  ko: {
    translate: "English",
    logout: "로그아웃",
    stocks: "종목",
    news: "뉴스",
    community: "커뮤니티",
    admin: "관리자",
    marketPulse: "시장 지표",
    refresh: "새로고침",
    stockList: "종목 리스트",
    stockHint: "미국 종목은 주요 거래소를 우선 표시합니다.",
    korea: "한국주식",
    us: "미국주식",
    search: "종목명 또는 심볼 검색",
    overview: "기업 개요",
    showOther: "영어 보기",
    access: "가입 승인",
  },
};

export function StocksPage() {
  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");
  const initialMarket: StockTab =
    searchParams.get("market")?.toUpperCase() === "KR" ? "KR" : "US";
  const initialSymbol =
    searchParams.get("symbol")?.trim().toUpperCase() ||
    (initialMarket === "KR" ? "005930" : "AAPL");
  const initialCurrency: DisplayCurrency =
    initialMarket === "KR"
      ? "KRW"
      : searchParams.get("currency")?.trim().toUpperCase() === "KRW"
        ? "KRW"
        : "USD";
  const [stockTab, setStockTab] = useState<StockTab>(initialMarket);
  const accessToken = useSessionStore((s) => s.accessToken);
  const language = usePreferencesStore((s) => s.language);
  const noticeMessage =
    notice === "profile-updated"
      ? language === "ko"
        ? "저장 완료되었습니다."
        : "Saved."
      : "";
  const usStocks = useMarketDataStore((s) => s.usStocks);
  const usSymbols = useMarketDataStore((s) => s.usSymbols);
  const krStocks = useMarketDataStore((s) => s.krStocks);
  const krSymbols = useMarketDataStore((s) => s.krSymbols);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const liveSeries = useMarketDataStore((s) => s.liveSeries);
  const applyTrade = useMarketDataStore((s) => s.applyTrade);
  const exchangeRate = useMarketDataStore((s) => s.exchangeRate);
  const loadStockSymbols = useMarketDataStore((s) => s.loadStockSymbols);
  const router = useRouter();
  const [relatedPosts, setRelatedPosts] = useState<CommunityPost[]>([]);
  const [stockNews, setStockNews] = useState<MarketNews[]>([]);
  const [favoriteStocks, setFavoriteStocks] = useState<FavoriteStock[]>([]);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("1M");
  const [priceCurrency, setPriceCurrency] =
    useState<DisplayCurrency>(initialCurrency);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [movingAverageSeries, setMovingAverageSeries] = useState<
    CandleChart["movingAverages"]
  >({ "20": [], "50": [], "120": [] });
  const [chartLoading, setChartLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState("");
  const detailRequestIdRef = useRef(0);
  const candleRequestIdRef = useRef(0);
  const debouncedSearch = useDebouncedValue(search, 180);
  const selectedFavorite = useMemo(
    () =>
      favoriteStocks.some(
        (stock) => stock.symbol === selectedSymbol && stock.market === stockTab,
      ),
    [favoriteStocks, selectedSymbol, stockTab],
  );

  // 셸(레이아웃)에서 stocks가 곧 기본 라우트라 별도 전환 불필요.
  const openStocksView = useCallback(() => {}, []);

  useEffect(() => {
    if (accessToken) {
      void loadStockSymbols(accessToken);
    }
  }, [accessToken, loadStockSymbols]);

  useStockRouteSelection({
    selectedSymbol,
    stockTab,
    krSymbols,
    usSymbols,
    openStocksView,
    setStockTab,
    setSelectedSymbol,
    setPriceCurrency,
    setSearch,
  });

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }

    const nextCurrency = stockTab === "KR" ? "KRW" : priceCurrency;
    const params = new URLSearchParams();
    params.set("symbol", selectedSymbol);
    params.set("market", stockTab);
    params.set("currency", nextCurrency);
    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();

    if (nextQuery !== currentQuery) {
      router.replace(`/?${nextQuery}`, { scroll: false });
    }
  }, [priceCurrency, router, searchParams, selectedSymbol, stockTab]);

  const visibleSymbols = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    const source = usSymbols.length
      ? usSymbols
      : usStocks.map((stock) => ({
          symbol: stock.symbol,
          displaySymbol: stock.symbol,
          description: stock.name ?? stock.symbol,
          type: "Common Stock",
        }));

    if (!query) {
      return source.slice(0, 80);
    }

    return source
      .map((item) => ({ item, score: stockSearchScore(item, debouncedSearch) }))
      .filter(({ score }) => score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || a.item.symbol.localeCompare(b.item.symbol),
      )
      .map(({ item }) => item)
      .slice(0, 24);
  }, [debouncedSearch, usStocks, usSymbols]);

  const visibleKrSymbols = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) {
      return krSymbols.slice(0, 24);
    }

    return krSymbols
      .map((item) => ({ item, score: stockSearchScore(item, debouncedSearch) }))
      .filter(({ score }) => score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || a.item.symbol.localeCompare(b.item.symbol),
      )
      .map(({ item }) => item)
      .slice(0, 24);
  }, [debouncedSearch, krSymbols]);

  async function loadRelatedPosts(symbol: string, token = accessToken) {
    if (!token || !symbol) {
      return;
    }
    const posts = await apiRequest<CommunityPost[]>(
      `/community/related?symbol=${encodeURIComponent(symbol)}`,
      "GET",
      { accessToken: token },
    ).catch(() => []);
    setRelatedPosts(posts);
  }

  async function loadStockNews(symbol: string, token = accessToken) {
    if (!token || !symbol) {
      return;
    }
    const news = await apiRequest<MarketNews[]>(
      `/markets/stocks/news?symbol=${encodeURIComponent(symbol)}&market=${stockTab}&language=ko`,
      "GET",
      { accessToken: token },
    ).catch(() => []);
    setStockNews(news);
  }

  async function loadFavoriteStocks(token = accessToken) {
    if (!token) {
      return;
    }

    const favorites = await apiRequest<FavoriteStock[]>(
      "/markets/favorites",
      "GET",
      { accessToken: token },
    ).catch(() => []);
    setFavoriteStocks(favorites);
  }

  async function toggleFavoriteStock() {
    if (!accessToken || !selectedSymbol || favoriteBusy) {
      return;
    }

    setFavoriteBusy(true);
    try {
      if (selectedFavorite) {
        await apiRequest<{ ok: true }>(
          `/markets/favorites/${stockTab}/${encodeURIComponent(selectedSymbol)}`,
          "DELETE",
          { accessToken },
        );
        setFavoriteStocks((items) =>
          items.filter(
            (item) =>
              !(item.symbol === selectedSymbol && item.market === stockTab),
          ),
        );
      } else {
        const favorite = await apiRequest<FavoriteStock>(
          "/markets/favorites",
          "POST",
          {
            accessToken,
            body: {
              symbol: selectedSymbol,
              market: stockTab,
              name: stockDetail?.profile.name,
            },
          },
        );
        setFavoriteStocks((items) => [
          favorite,
          ...items.filter(
            (item) =>
              !(
                item.symbol === favorite.symbol &&
                item.market === favorite.market
              ),
          ),
        ]);
      }
    } finally {
      setFavoriteBusy(false);
    }
  }

  function openRelatedPost(postId: string) {
    router.push(`/community/${encodeURIComponent(postId)}`);
  }

  async function loadStockDetail(symbol: string, token = accessToken) {
    if (!token) {
      return;
    }

    const requestId = ++detailRequestIdRef.current;
    setStockDetail(null);
    try {
      const detail = await apiRequest<StockDetail>(
        `/markets/stocks/detail?symbol=${encodeURIComponent(symbol)}&market=${stockTab === "KR" ? "KR" : "US"}`,
        "GET",
        { accessToken: token },
      );
      if (requestId === detailRequestIdRef.current) {
        setStockDetail(detail);
      }
    } catch (detailError) {
      if (requestId === detailRequestIdRef.current) {
        setError(
          detailError instanceof Error
            ? detailError.message
            : language === "ko"
              ? "종목 정보를 불러오지 못했습니다."
              : "Could not load stock detail.",
        );
      }
    }
  }

  async function loadCandles(
    symbol: string,
    period: ChartPeriod,
    token = accessToken,
  ) {
    if (!token) {
      return;
    }

    const requestId = ++candleRequestIdRef.current;
    setCandles([]);
    setMovingAverageSeries({ "20": [], "50": [], "120": [] });
    setChartLoading(true);
    try {
      const baseUrl = `/markets/candles?symbol=${encodeURIComponent(symbol)}&period=${period}&market=${stockTab === "KR" ? "KR" : "US"}`;
      const chart = await apiRequest<CandleChart>(
        `${baseUrl}&indicators=true`,
        "GET",
        { accessToken: token },
      );
      if (requestId === candleRequestIdRef.current) {
        setCandles(chart.candles);
        setMovingAverageSeries(chart.movingAverages);
      }
    } catch (candleError) {
      if (requestId === candleRequestIdRef.current) {
        setError(
          candleError instanceof Error
            ? candleError.message
            : "Could not load chart candles.",
        );
      }
    } finally {
      if (requestId === candleRequestIdRef.current) {
        setChartLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!accessToken || !selectedSymbol) {
      return;
    }

    queueMicrotask(() => {
      loadStockDetail(selectedSymbol, accessToken);
      loadRelatedPosts(selectedSymbol, accessToken);
      loadStockNews(selectedSymbol, accessToken);
    });
  }, [accessToken, selectedSymbol, stockTab]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    queueMicrotask(() => {
      loadFavoriteStocks(accessToken);
    });
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !selectedSymbol) {
      return;
    }

    queueMicrotask(() => {
      loadCandles(selectedSymbol, chartPeriod, accessToken);
    });
  }, [accessToken, selectedSymbol, chartPeriod, stockTab]);

  useEffect(() => {
    if (stockTab === "US" && selectedSymbol) {
      window.dispatchEvent(
        new CustomEvent("market:subscribe", { detail: [selectedSymbol] }),
      );
    }
  }, [selectedSymbol, stockTab]);

  useEffect(() => {
    if (!accessToken || stockTab !== "KR" || !selectedSymbol) {
      return;
    }
    let active = true;
    const refreshQuote = async () => {
      const quote = await apiRequest<MarketQuote>(
        `/markets/stocks/quote?symbol=${encodeURIComponent(selectedSymbol)}&market=KR`,
        "GET",
        { accessToken },
      ).catch(() => null);
      if (!active || !quote || quote.current <= 0) {
        return;
      }
      applyTrade({
        symbol: selectedSymbol,
        price: quote.current,
        timestamp: Date.now(),
        volume: 0,
        change: quote.change,
        percentChange: quote.percentChange,
        previousClose: quote.previousClose,
      });
    };
    void refreshQuote();
    const interval = window.setInterval(refreshQuote, 15_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [accessToken, applyTrade, selectedSymbol, stockTab]);

  return (
    <>
      {noticeMessage ? <Notice message={noticeMessage} error="" /> : null}
      {error ? <Notice message="" error={error} /> : null}
      <div className="grid min-w-0 flex-1 gap-4 py-4 sm:gap-6 sm:py-6">
        <StocksView
          stockTab={stockTab}
          setStockTab={setStockTab}
          favoriteStocks={favoriteStocks}
          visibleSymbols={visibleSymbols}
          usStocks={usStocks}
          krStocks={krStocks}
          visibleKrSymbols={visibleKrSymbols}
          selectedSymbol={selectedSymbol}
          setSelectedSymbol={setSelectedSymbol}
          stockDetail={stockDetail}
          livePrices={livePrices}
          liveSeries={liveSeries}
          candles={candles}
          movingAverageSeries={movingAverageSeries}
          chartPeriod={chartPeriod}
          setChartPeriod={setChartPeriod}
          chartLoading={chartLoading}
          language={language}
          search={search}
          setSearch={setSearch}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          debouncedSearch={debouncedSearch}
          priceCurrency={priceCurrency}
          setPriceCurrency={setPriceCurrency}
          relatedPosts={relatedPosts}
          stockNews={stockNews}
          onRelatedPostClick={openRelatedPost}
          exchangeRate={exchangeRate}
          selectedFavorite={selectedFavorite}
          favoriteBusy={favoriteBusy}
          onToggleFavorite={toggleFavoriteStock}
        />
      </div>
    </>
  );
}

function StocksView({
  stockTab,
  setStockTab,
  favoriteStocks,
  visibleSymbols,
  usStocks,
  krStocks,
  visibleKrSymbols,
  selectedSymbol,
  setSelectedSymbol,
  stockDetail,
  livePrices,
  liveSeries,
  candles,
  movingAverageSeries,
  chartPeriod,
  setChartPeriod,
  chartLoading,
  search,
  setSearch,
  searchOpen,
  setSearchOpen,
  debouncedSearch,
  language,
  priceCurrency,
  setPriceCurrency,
  relatedPosts,
  stockNews,
  onRelatedPostClick,
  exchangeRate,
  selectedFavorite,
  favoriteBusy,
  onToggleFavorite,
}: {
  stockTab: StockTab;
  setStockTab: (tab: StockTab) => void;
  favoriteStocks: FavoriteStock[];
  visibleSymbols: StockSymbol[];
  usStocks: MarketQuote[];
  krStocks: MarketQuote[];
  visibleKrSymbols: StockSymbol[];
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  stockDetail: StockDetail | null;
  livePrices: Record<string, TradeTick>;
  liveSeries: Record<string, TradeTick[]>;
  candles: CandlePoint[];
  movingAverageSeries: CandleChart["movingAverages"];
  chartPeriod: ChartPeriod;
  setChartPeriod: (period: ChartPeriod) => void;
  chartLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  searchOpen: boolean;
  setSearchOpen: (value: boolean) => void;
  debouncedSearch: string;
  language: Language;
  priceCurrency: DisplayCurrency;
  setPriceCurrency: (currency: DisplayCurrency) => void;
  relatedPosts: CommunityPost[];
  stockNews: MarketNews[];
  onRelatedPostClick: (postId: string) => void;
  exchangeRate: number | null;
  selectedFavorite: boolean;
  favoriteBusy: boolean;
  onToggleFavorite: () => void;
}) {
  const selectStock = (symbol: string, market: StockTab = stockTab) => {
    if (market !== stockTab) {
      setStockTab(market);
      setPriceCurrency(market === "KR" ? "KRW" : "USD");
    }
    setSelectedSymbol(symbol);
    setSearch("");
  };

  return (
    <section className="-mx-4 min-w-0 border-y border-border bg-surface p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
      <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <SectionHeader
            eyebrow={language === "ko" ? "실시간 시세" : "Live quotes"}
            title={copy[language].stockList}
          />
          <p className="mt-2 text-sm text-muted">{copy[language].stockHint}</p>
        </div>
        <SegmentedControl
          className="w-full md:inline-flex md:w-auto md:min-w-[240px]"
          buttonClassName="sm:flex-1"
          aria-label={copy[language].stockList}
          options={[
            { value: "KR", label: copy[language].korea },
            { value: "US", label: copy[language].us },
          ]}
          value={stockTab}
          onChange={(tab) => {
            setStockTab(tab as StockTab);
            setSelectedSymbol(tab === "KR" ? "005930" : "AAPL");
            setPriceCurrency(tab === "KR" ? "KRW" : "USD");
            setSearch("");
          }}
        />
      </div>

      {stockTab === "KR" ? (
        <div className="mt-4 grid min-w-0 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <div className="min-w-0">
            <StockSearchPopover
              market="KR"
              language={language}
              search={search}
              setSearch={setSearch}
              debouncedSearch={debouncedSearch}
              open={searchOpen}
              setOpen={setSearchOpen}
              symbols={visibleKrSymbols}
              quotes={krStocks}
              selectedSymbol={selectedSymbol}
              priceCurrency="KRW"
              exchangeRate={exchangeRate}
              onSelect={(symbol) => selectStock(symbol, "KR")}
            />
            <div className="mt-2 hidden xl:block">
              <RelatedPosts
                posts={relatedPosts}
                onPostClick={onRelatedPostClick}
                language={language}
              />
              <RelatedNews news={stockNews} language={language} />
            </div>
          </div>
          <StockDetailPanel
            detail={stockDetail}
            live={livePrices[selectedSymbol]}
            series={liveSeries[selectedSymbol] ?? []}
            candles={candles}
            movingAverageSeries={movingAverageSeries}
            chartPeriod={chartPeriod}
            setChartPeriod={setChartPeriod}
            chartLoading={chartLoading}
            language={language}
            priceCurrency="KRW"
            setPriceCurrency={setPriceCurrency}
            exchangeRate={exchangeRate}
            selectedFavorite={selectedFavorite}
            favoriteBusy={favoriteBusy}
            onToggleFavorite={onToggleFavorite}
          />
          <div className="min-w-0 -mt-2 xl:hidden">
            <RelatedPosts
              posts={relatedPosts}
              onPostClick={onRelatedPostClick}
              language={language}
            />
            <RelatedNews news={stockNews} language={language} />
          </div>
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <div className="min-w-0">
            <StockSearchPopover
              market="US"
              language={language}
              search={search}
              setSearch={setSearch}
              debouncedSearch={debouncedSearch}
              open={searchOpen}
              setOpen={setSearchOpen}
              symbols={visibleSymbols}
              quotes={usStocks}
              livePrices={livePrices}
              selectedSymbol={selectedSymbol}
              priceCurrency={priceCurrency}
              exchangeRate={exchangeRate}
              onSelect={(symbol) => selectStock(symbol, "US")}
            />
            <div className="mt-2 hidden xl:block">
              <RelatedPosts
                posts={relatedPosts}
                onPostClick={onRelatedPostClick}
                language={language}
              />
              <RelatedNews news={stockNews} language={language} />
            </div>
          </div>
          <StockDetailPanel
            detail={stockDetail}
            live={livePrices[selectedSymbol]}
            series={liveSeries[selectedSymbol] ?? []}
            candles={candles}
            movingAverageSeries={movingAverageSeries}
            chartPeriod={chartPeriod}
            setChartPeriod={setChartPeriod}
            chartLoading={chartLoading}
            language={language}
            priceCurrency={priceCurrency}
            setPriceCurrency={setPriceCurrency}
            exchangeRate={exchangeRate}
            selectedFavorite={selectedFavorite}
            favoriteBusy={favoriteBusy}
            onToggleFavorite={onToggleFavorite}
          />
          <div className="min-w-0 -mt-2 xl:hidden">
            <RelatedPosts
              posts={relatedPosts}
              onPostClick={onRelatedPostClick}
              language={language}
            />
            <RelatedNews news={stockNews} language={language} />
          </div>
        </div>
      )}
    </section>
  );
}

function StockDetailPanel({
  detail,
  live,
  series,
  candles,
  movingAverageSeries,
  chartPeriod,
  setChartPeriod,
  chartLoading,
  language,
  priceCurrency,
  setPriceCurrency,
  exchangeRate,
  selectedFavorite,
  favoriteBusy,
  onToggleFavorite,
}: {
  detail: StockDetail | null;
  live?: TradeTick;
  series: TradeTick[];
  candles: CandlePoint[];
  movingAverageSeries: CandleChart["movingAverages"];
  chartPeriod: ChartPeriod;
  setChartPeriod: (period: ChartPeriod) => void;
  chartLoading: boolean;
  language: Language;
  priceCurrency: DisplayCurrency;
  setPriceCurrency: (currency: DisplayCurrency) => void;
  exchangeRate: number | null;
  selectedFavorite: boolean;
  favoriteBusy: boolean;
  onToggleFavorite: () => void;
}) {
  if (!detail) {
    return <StockDetailSkeleton />;
  }

  const quote = applyLiveTrade(detail.quote, live);
  const chartReturn = calculateChartPeriodReturn(
    chartPeriod,
    candles,
    quote,
    chartLoading,
  );
  const detailSourceCurrency =
    detail.profile.currency === "KRW"
      ? "KRW"
      : (detail.quote.currency ?? "USD");
  const displayMarketCap = detail.profile.marketCapitalization
    ? formatMarketCap(
        detail.profile.marketCapitalization,
        priceCurrency,
        detailSourceCurrency,
        exchangeRate,
      )
    : "-";
  const metricItems = buildMetricItems(
    detail.metrics,
    language,
    priceCurrency,
    detailSourceCurrency,
    exchangeRate,
  );
  const isKoreanMarket =
    detail.profile.currency === "KRW" && detail.profile.country === "대한민국";
  const logoUrl =
    detail.profile.logo ||
    (isKoreanMarket
      ? `https://ssl.pstatic.net/imgstock/fn/real/logo/stock/Stock${detail.symbol}.svg`
      : getFallbackLogoUrl(detail.profile.weburl));
  const nextEarningsLabel = formatNextEarnings(detail.nextEarnings, language);
  const valuationItems = [
    {
      label: translateDetailLabel(language, "marketCap"),
      value: displayMarketCap,
    },
    ...metricItems,
  ];

  return (
    <div className="min-w-0 rounded-md border border-border p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted">{detail.profile.exchange}</p>
          <h3 className="mt-1 break-words text-xl font-semibold sm:text-2xl">
            {detail.profile.name || detail.symbol}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {detail.symbol} ·{" "}
            {detail.profile.finnhubIndustry ||
              (language === "ko" ? "섹터 정보 없음" : "Unknown sector")}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
          {nextEarningsLabel ? (
            detail.isSp500 ? (
              <Link
                href={
                  "/stocks/US/" +
                  encodeURIComponent(detail.symbol) +
                  "/earnings"
                }
                className="inline-flex max-w-[260px] items-center rounded-md border border-primary/25 bg-primary/10 px-2.5 py-2 text-xs font-semibold leading-5 text-primary hover:underline sm:max-w-md"
              >
                <span className="whitespace-normal break-keep">
                  {nextEarningsLabel}
                </span>
              </Link>
            ) : (
              <span className="inline-flex max-w-[260px] items-center rounded-md border border-primary/25 bg-primary/10 px-2.5 py-2 text-xs font-semibold leading-5 text-primary sm:max-w-md">
                <span className="whitespace-normal break-keep">
                  {nextEarningsLabel}
                </span>
              </span>
            )
          ) : null}
          <Button
            variant="secondary"
            size="icon"
            onClick={onToggleFavorite}
            disabled={favoriteBusy}
            title={
              selectedFavorite
                ? language === "ko"
                  ? "관심종목 제거"
                  : "Remove from watchlist"
                : language === "ko"
                  ? "관심종목 추가"
                  : "Add to watchlist"
            }
            aria-label={
              selectedFavorite
                ? language === "ko"
                  ? "관심종목 제거"
                  : "Remove from watchlist"
                : language === "ko"
                  ? "관심종목 추가"
                  : "Add to watchlist"
            }
          >
            <Star
              size={18}
              className={selectedFavorite ? "text-[#f4b400]" : "text-muted"}
              fill={selectedFavorite ? "currentColor" : "none"}
            />
          </Button>
          {!isKoreanMarket ? (
            <Button
              variant="secondary"
              size="icon"
              onClick={() =>
                setPriceCurrency(priceCurrency === "USD" ? "KRW" : "USD")
              }
            >
              {priceCurrency === "USD" ? "원" : "$"}
            </Button>
          ) : null}
          <CompanyIcon
            logoUrl={logoUrl}
            name={detail.profile.name || detail.symbol}
            symbol={detail.symbol}
          />
        </div>
      </div>
      <div className="mt-6">
        <QuoteCard
          quote={quote}
          live={!!live}
          displayCurrency={priceCurrency}
          exchangeRate={exchangeRate}
          language={language}
        />
      </div>
      <PriceRange52Week
        current={quote.current}
        low={numericMetric(detail.metrics, "52WeekLow")}
        high={numericMetric(detail.metrics, "52WeekHigh")}
        displayCurrency={priceCurrency}
        sourceCurrency={detailSourceCurrency}
        exchangeRate={exchangeRate}
        language={language}
      />
      <div className="mt-5 rounded-md border border-border bg-surface-muted p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {translateDetailLabel(language, "realtimeChart")}
            </p>
            <p
              className={`mt-1 text-sm font-semibold ${
                chartReturn === null || chartReturn === 0
                  ? "text-muted"
                  : chartReturn > 0
                    ? "text-positive"
                    : "text-negative"
              }`}
            >
              {language === "ko"
                ? `${chartPeriod} 수익률`
                : `${chartPeriod} return`}{" "}
              {chartReturn === null
                ? "-"
                : `${chartReturn > 0 ? "+" : ""}${formatNumber(chartReturn)}%`}
            </p>
          </div>
          <SegmentedControl
            className="grid w-full grid-cols-4 sm:inline-flex sm:w-auto"
            buttonClassName="min-w-0 px-2 text-xs sm:px-4 sm:text-sm"
            aria-label={translateDetailLabel(language, "realtimeChart")}
            options={chartPeriods.map((period) => ({
              value: period,
              label: period,
            }))}
            value={chartPeriod}
            onChange={setChartPeriod}
          />
        </div>
        <>
          <RealtimeChart
            candles={candles}
            movingAverageSeries={movingAverageSeries}
            live={live}
            loading={chartLoading}
            period={chartPeriod}
            language={language}
          />
          <p className="mt-2 text-xs text-muted">
            {series.length
              ? language === "ko"
                ? `실시간 체결 ${series.length}건 수신`
                : `${series.length} live ticks received`
              : language === "ko"
                ? "실시간 체결 시 마지막 봉이 갱신됩니다."
                : "Live ticks update the last candle when available."}
          </p>
        </>
      </div>
      <div className="mt-5 rounded-md border border-border p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {translateDetailLabel(language, "companyOverview")}
            </p>
            <p className="mt-1 text-xs text-muted">
              {translateDetailLabel(language, "source")}:{" "}
              {detail.overview.source}
              {detail.overview.fetchedAt
                ? ` · ${new Date(detail.overview.fetchedAt).toLocaleDateString()}`
                : ""}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-foreground">
          {language === "en" ? detail.overview.en : detail.overview.ko}
        </p>
        <div className="mt-3 grid gap-2 sm:gap-3 md:grid-cols-2">
          <InfoBox
            label={translateDetailLabel(language, "country")}
            value={detail.profile.country || "-"}
          />
          <InfoBox
            label={translateDetailLabel(language, "ipo")}
            value={detail.profile.ipo || "-"}
          />
          <InfoBox
            label={translateDetailLabel(language, "website")}
            value={detail.profile.weburl || "-"}
          />
          <InfoBox
            label={translateDetailLabel(language, "sharesOutstanding")}
            value={
              detail.profile.shareOutstanding
                ? `${formatNumber(detail.profile.shareOutstanding)}M`
                : "-"
            }
          />
        </div>
        <div className="mt-3 grid gap-2 sm:gap-3 md:grid-cols-2">
          <InfoBox
            label={translateDetailLabel(language, "open")}
            value={formatMoney(
              quote.open,
              priceCurrency,
              quote.currency,
              exchangeRate,
            )}
          />
          <InfoBox
            label={translateDetailLabel(language, "previousClose")}
            value={formatMoney(
              quote.previousClose,
              priceCurrency,
              quote.currency,
              exchangeRate,
            )}
          />
        </div>
      </div>
      <div className="mt-5 rounded-md border border-border p-3 sm:p-4">
        <p className="text-sm font-semibold text-foreground">
          {translateDetailLabel(language, "metrics")}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
          {valuationItems.map((item) => (
            <InfoBox key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </div>
      <FinancialBarChart
        financials={detail.financials ?? []}
        language={language}
        symbol={detail.symbol}
        currency={priceCurrency}
        sourceCurrency={detail.profile.currency === "KRW" ? "KRW" : "USD"}
        exchangeRate={exchangeRate}
        showMore={!!detail.isSp500}
      />
    </div>
  );
}

function numericMetric(
  metrics: StockDetail["metrics"],
  key: string,
): number | null {
  const value = Number(metrics?.[key]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function PriceRange52Week({
  current,
  low,
  high,
  displayCurrency,
  sourceCurrency,
  exchangeRate,
  language,
}: {
  current: number;
  low: number | null;
  high: number | null;
  displayCurrency: DisplayCurrency;
  sourceCurrency: string;
  exchangeRate: number | null;
  language: Language;
}) {
  if (low === null || high === null || high <= low) return null;
  const position = Math.min(
    100,
    Math.max(0, ((current - low) / (high - low)) * 100),
  );

  return (
    <div className="mt-5 rounded-md border border-border p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">
          {language === "ko" ? "52주 가격 범위" : "52-week price range"}
        </p>
        <p className="text-xs font-semibold text-muted">
          {language === "ko" ? "현재 위치" : "Current position"}{" "}
          {formatNumber(position)}%
        </p>
      </div>
      <div className="relative mt-5 h-2 rounded-full bg-surface-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${position}%` }}
        />
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="mt-3 flex items-start justify-between gap-3 text-xs">
        <div>
          <p className="text-muted">{language === "ko" ? "최저" : "Low"}</p>
          <p className="mt-0.5 font-semibold text-foreground">
            {formatMoney(low, displayCurrency, sourceCurrency, exchangeRate)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-muted">{language === "ko" ? "현재" : "Current"}</p>
          <p className="mt-0.5 font-semibold text-primary">
            {formatMoney(
              current,
              displayCurrency,
              sourceCurrency,
              exchangeRate,
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted">{language === "ko" ? "최고" : "High"}</p>
          <p className="mt-0.5 font-semibold text-foreground">
            {formatMoney(high, displayCurrency, sourceCurrency, exchangeRate)}
          </p>
        </div>
      </div>
    </div>
  );
}

function earningsPeriodLabel(item: NonNullable<StockDetail["nextEarnings"]>) {
  const baseDate = item.fiscalDateEnding || item.reportDate;
  const date = new Date(baseDate.slice(0, 10) + "T00:00:00Z");
  if (!Number.isNaN(date.getTime())) {
    date.setUTCMonth(date.getUTCMonth() - 1);
    return (
      date.getUTCFullYear() + " Q" + (Math.floor(date.getUTCMonth() / 3) + 1)
    );
  }
  return item.reportDate.slice(0, 7);
}

function StockSearchPopover({
  market,
  language,
  search,
  setSearch,
  debouncedSearch,
  open,
  setOpen,
  symbols,
  quotes,
  livePrices = {},
  selectedSymbol,
  priceCurrency,
  exchangeRate,
  onSelect,
}: {
  market: StockTab;
  language: Language;
  search: string;
  setSearch: (value: string) => void;
  debouncedSearch: string;
  open: boolean;
  setOpen: (value: boolean) => void;
  symbols: StockSymbol[];
  quotes: MarketQuote[];
  livePrices?: Record<string, TradeTick>;
  selectedSymbol: string;
  priceCurrency: DisplayCurrency;
  exchangeRate: number | null;
  onSelect: (symbol: string) => void;
}) {
  const [recentStocks, setRecentStocks] = useState<RecentStock[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const storagePrefix = `15f:stocks:v2:${market.toLowerCase()}`;
  const quoteBySymbol = useMemo(
    () => new Map(quotes.map((quote) => [quote.symbol, quote])),
    [quotes],
  );
  const query = debouncedSearch.trim();
  const isDebouncing = search.trim() !== query;
  const showPopover =
    open &&
    (search.trim().length > 0 ||
      symbols.length > 0 ||
      recentStocks.length > 0 ||
      recentSearches.length > 0);
  const resultLabel =
    language === "ko"
      ? query
        ? "검색 결과"
        : "추천 종목"
      : query
        ? "Search results"
        : "Suggested";

  useEffect(() => {
    try {
      setRecentStocks(
        JSON.parse(
          window.localStorage.getItem(`${storagePrefix}:viewed`) ?? "[]",
        ) as RecentStock[],
      );
      setRecentSearches(
        JSON.parse(
          window.localStorage.getItem(`${storagePrefix}:searches`) ?? "[]",
        ) as string[],
      );
    } catch {
      setRecentStocks([]);
      setRecentSearches([]);
    }
  }, [storagePrefix]);

  function selectSymbol(symbol: string) {
    const selected = symbols.find((candidate) => candidate.symbol === symbol);
    const previous = recentStocks.find((candidate) => candidate.symbol === symbol);
    const selectedDescription = selected?.description?.trim();
    const previousDescription = previous?.description?.trim();
    const description =
      market === "KR"
        ? resolveKoreanRecentName(
            symbol,
            selectedDescription,
            previousDescription,
          )
        : selectedDescription || previousDescription || symbol;
    const nextStocks = [
      {
        symbol,
        description,
      },
      ...recentStocks.filter((candidate) => candidate.symbol !== symbol),
    ].slice(0, 8);
    setRecentStocks(nextStocks);
    window.localStorage.setItem(
      `${storagePrefix}:viewed`,
      JSON.stringify(nextStocks),
    );
    const term = search.trim();
    if (term) {
      const nextSearches = [
        term,
        ...recentSearches.filter(
          (candidate) => candidate.toLowerCase() !== term.toLowerCase(),
        ),
      ].slice(0, 8);
      setRecentSearches(nextSearches);
      window.localStorage.setItem(
        `${storagePrefix}:searches`,
        JSON.stringify(nextSearches),
      );
    }
    onSelect(symbol);
    setSearch("");
    setOpen(false);
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <div
        className={`group flex h-12 items-center gap-2 rounded-md border bg-surface px-3 shadow-sm transition-all sm:h-11 ${
          open
            ? "border-primary ring-4 ring-primary/10"
            : "border-border-strong hover:border-primary/60"
        }`}
      >
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Search size={17} />
        </div>
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={copy[language].search}
          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-muted sm:text-sm"
        />
        {isDebouncing ? (
          <span
            className="size-2 shrink-0 rounded-full bg-primary/70"
            aria-hidden
          />
        ) : null}
        {search ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setOpen(true);
            }}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            aria-label={language === "ko" ? "검색어 지우기" : "Clear search"}
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {showPopover ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-md border border-border bg-surface shadow-xl shadow-[#152033]/10">
          {!query && (recentStocks.length || recentSearches.length) ? (
            <div className="border-b border-border p-3">
              {recentStocks.length ? (
                <>
                  <p className="text-xs font-semibold text-muted">
                    {language === "ko" ? "최근 본 종목" : "Recently viewed"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recentStocks.map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectSymbol(item.symbol)}
                        title={item.description}
                        className="cursor-pointer rounded-md border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-semibold text-foreground hover:border-primary hover:text-primary"
                      >
                        {market === "KR" ? item.description : item.symbol}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              {recentSearches.length ? (
                <div className={recentStocks.length ? "mt-3" : ""}>
                  <p className="text-xs font-semibold text-muted">
                    {language === "ko" ? "최근 검색어" : "Recent searches"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSearch(term);
                          setOpen(true);
                        }}
                        className="cursor-pointer rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-muted">{resultLabel}</p>
            <p className="text-xs font-semibold text-muted">{symbols.length}</p>
          </div>
          <div className="max-h-[min(360px,52dvh)] overflow-auto p-1">
            {symbols.length ? (
              symbols.map((item) => {
                const quote = quoteBySymbol.get(item.symbol);
                const live = livePrices[item.symbol];
                const displayPrice = live
                  ? formatMoney(
                      live.price,
                      priceCurrency,
                      item.currency === "KRW" ? "KRW" : "USD",
                      exchangeRate,
                    )
                  : quote
                    ? formatMoney(
                        quote.current,
                        priceCurrency,
                        quote.currency ?? (market === "KR" ? "KRW" : "USD"),
                        exchangeRate,
                      )
                    : "";
                const primary =
                  market === "KR" ? item.description : item.symbol;
                const secondary =
                  market === "KR" ? item.symbol : item.description;

                return (
                  <button
                    key={item.symbol}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSymbol(item.symbol)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface-muted ${
                      selectedSymbol === item.symbol ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {primary}
                      </p>
                      <p className="truncate text-xs text-muted">{secondary}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-foreground">
                      {displayPrice}
                    </p>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted">
                {language === "ko"
                  ? "검색 결과가 없습니다."
                  : "No matches found."}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function resolveKoreanRecentName(
  symbol: string,
  selectedDescription?: string,
  previousDescription?: string,
) {
  const isCodeLike = (value?: string) => !!value && /^\d{5,6}$/.test(value);
  if (selectedDescription && !isCodeLike(selectedDescription)) {
    return selectedDescription;
  }
  if (previousDescription && !isCodeLike(previousDescription)) {
    return previousDescription;
  }
  return selectedDescription || previousDescription || symbol;
}

function FavoriteStockList({
  favorites,
  selectedSymbol,
  selectedMarket,
  language,
  priceCurrency,
  exchangeRate,
  onSelect,
}: {
  favorites: FavoriteStock[];
  selectedSymbol: string;
  selectedMarket: StockTab;
  language: Language;
  priceCurrency: DisplayCurrency;
  exchangeRate: number | null;
  onSelect: (symbol: string, market: StockTab) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Star size={15} className="text-[#f4b400]" fill="currentColor" />
          {language === "ko" ? "내관심종목" : "Watchlist"}
        </p>
        <p className="text-xs font-semibold text-muted">{favorites.length}</p>
      </div>
      <div className="mt-3 space-y-1.5">
        {favorites.length ? (
          favorites.map((favorite) => {
            const sourceCurrency =
              favorite.currency ?? (favorite.market === "KR" ? "KRW" : "USD");
            const displayCurrency =
              favorite.market === "KR" ? "KRW" : priceCurrency;
            const active =
              favorite.symbol === selectedSymbol &&
              favorite.market === selectedMarket;
            const primary =
              favorite.market === "KR"
                ? favorite.name || favorite.symbol
                : favorite.symbol;
            const secondary =
              favorite.market === "KR"
                ? favorite.symbol
                : favorite.name || favorite.symbol;
            const positive = favorite.change >= 0;

            return (
              <button
                key={`${favorite.market}-${favorite.symbol}`}
                type="button"
                onClick={() => onSelect(favorite.symbol, favorite.market)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface ${
                  active ? "bg-primary/10" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {primary}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {favorite.market} · {secondary}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-foreground">
                    {formatMoney(
                      favorite.current,
                      displayCurrency,
                      sourceCurrency,
                      exchangeRate,
                    )}
                  </p>
                  <p
                    className={`text-xs font-semibold ${
                      positive ? "text-positive" : "text-negative"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {formatNumber(favorite.percentChange)}%
                  </p>
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-md border border-dashed border-border px-3 py-8 text-center">
            <p className="text-sm font-semibold text-foreground">
              {language === "ko"
                ? "아직 관심종목이 없습니다."
                : "No favorites yet."}
            </p>
            <p className="mt-1 text-xs text-muted">
              {language === "ko"
                ? "종목 상세의 별 아이콘을 눌러 추가하세요."
                : "Use the star button on a stock detail page."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function calculateChartPeriodReturn(
  period: ChartPeriod,
  candles: CandlePoint[],
  quote: MarketQuote,
  loading: boolean,
): number | null {
  if (loading) {
    return null;
  }
  if (period === "1D") {
    return Number.isFinite(quote.percentChange) ? quote.percentChange : null;
  }
  const firstClose = candles[0]?.close;
  const latestPrice =
    quote.current > 0 ? quote.current : candles[candles.length - 1]?.close;
  if (!firstClose || !latestPrice) {
    return null;
  }
  const result = ((latestPrice - firstClose) / firstClose) * 100;
  return Number.isFinite(result) ? result : null;
}

function RealtimeChart({
  candles,
  movingAverageSeries,
  live,
  loading,
  period,
  language,
}: {
  candles: CandlePoint[];
  movingAverageSeries: CandleChart["movingAverages"];
  live?: TradeTick;
  loading: boolean;
  period: ChartPeriod;
  language: Language;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const movingAverageRefs = useRef(new Map<number, ISeriesApi<"Line">>());

  useEffect(() => {
    if (!containerRef.current || chartRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: "#f9fafc" },
        textColor: "#344052",
      },
      grid: {
        vertLines: { color: "#edf0f5" },
        horzLines: { color: "#edf0f5" },
      },
      rightPriceScale: {
        borderColor: "#d9dee8",
      },
      timeScale: {
        borderColor: "#d9dee8",
        timeVisible: period === "1D",
        secondsVisible: false,
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#2e7d4f",
      downColor: "#b64242",
      borderVisible: false,
      wickUpColor: "#2e7d4f",
      wickDownColor: "#b64242",
    });
    movingAverages.forEach((average) => {
      movingAverageRefs.current.set(
        average.period,
        chart.addSeries(LineSeries, {
          color: average.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        }),
      );
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      movingAverageRefs.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    const data: CandlestickData<Time>[] = [...candles]
      .sort((a, b) => a.time - b.time)
      .map((candle) => ({
        time: toChartTime(candle.time, period),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));
    seriesRef.current.setData(data);
    movingAverages.forEach((average) => {
      movingAverageRefs.current.get(average.period)?.setData(
        movingAverageSeries[String(average.period) as "20" | "50" | "120"].map(
          (point) => ({
            time: toChartTime(point.time, period),
            value: point.value,
          }),
        ),
      );
    });
    chartRef.current?.timeScale().fitContent();
    chartRef.current?.applyOptions({
      timeScale: {
        timeVisible: period === "1D",
        secondsVisible: false,
      },
    });
  }, [candles, movingAverageSeries, period]);

  useEffect(() => {
    if (!seriesRef.current || !live || candles.length === 0) {
      return;
    }

    const last = candles[candles.length - 1];
    const price = live.price;
    seriesRef.current.update({
      time: toChartTime(last.time, period),
      open: last.open,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      close: price,
    });
  }, [candles, live, period]);

  return (
    <div className="relative mt-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {movingAverages.map((average) => (
          <span
            key={average.period}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted"
          >
            <span
              className="h-0.5 w-4"
              style={{ backgroundColor: average.color }}
            />
            MA{average.period}
          </span>
        ))}
      </div>
      {loading ? (
        <div className="absolute right-3 top-3 z-10 rounded-md bg-surface/90 px-2 py-1 text-xs font-semibold text-muted">
          {language === "ko" ? "불러오는 중" : "Loading"}
        </div>
      ) : null}
      <div ref={containerRef} className="h-[220px] w-full sm:h-[260px]" />
    </div>
  );
}

function toChartTime(timestamp: number, period: ChartPeriod): Time {
  if (period === "1D") {
    return timestamp as Time;
  }

  const date = new Date(timestamp * 1000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  } as BusinessDay;
}

function QuoteCard({
  quote,
  compact = false,
  live = false,
  displayCurrency = "USD",
  exchangeRate,
  language = "ko",
}: {
  quote: MarketQuote;
  compact?: boolean;
  live?: boolean;
  displayCurrency?: DisplayCurrency;
  exchangeRate?: number | null;
  language?: Language;
}) {
  const positive = quote.change >= 0;
  const isIndex = quote.symbol.startsWith("KIS_INDEX:");
  const currentText = isIndex
    ? formatNumber(quote.current)
    : formatMoney(quote.current, displayCurrency, quote.currency, exchangeRate);
  const changeText = isIndex
    ? formatNumber(quote.change)
    : formatMoney(quote.change, displayCurrency, quote.currency, exchangeRate);
  return (
    <div className="rounded-md border border-border bg-surface-muted p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{quote.name || quote.symbol}</p>
        </div>
        {positive ? (
          <TrendingUp size={18} className="text-positive" />
        ) : (
          <TrendingDown size={18} className="text-negative" />
        )}
      </div>
      <p
        className={
          compact
            ? "mt-2 text-xl font-semibold"
            : "mt-3 text-2xl font-semibold sm:text-3xl"
        }
      >
        {currentText}
      </p>
      <p
        className={`mt-1 text-sm font-medium ${
          positive ? "text-positive" : "text-negative"
        }`}
      >
        {positive ? "+" : ""}
        {changeText} ({positive ? "+" : ""}
        {formatNumber(quote.percentChange)}%)
      </p>
      {live ? (
        <p className="mt-2 text-xs font-medium text-primary">
          {language === "ko" ? "실시간" : "Live tick"}
        </p>
      ) : null}
    </div>
  );
}

function RelatedPosts({
  posts,
  onPostClick,
  language,
}: {
  posts: CommunityPost[];
  onPostClick: (postId: string) => void;
  language: Language;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <MessageSquareText size={14} className="text-primary" />
        {language === "ko"
          ? "이 종목과 관련된 피드"
          : "Related community posts"}
      </p>
      <div className="mt-2 space-y-2">
        {posts.length ? (
          posts.slice(0, 3).map((post) => {
            const preview = getRelatedPostPreview(post);
            return (
              <button
                key={post.id}
                onClick={() => onPostClick(post.id)}
                className="block w-full cursor-pointer border-t border-border pt-2 text-left first:border-0 first:pt-0"
              >
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                  <p className="truncate text-sm font-semibold sm:max-w-[45%]">
                    {post.title || post.content}
                  </p>
                  <p className="min-w-0 flex-1 truncate text-[11px] text-muted">
                    {preview}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {post.author.nickname} ·{" "}
                  {new Date(post.createdAt).toLocaleDateString()}
                </p>
              </button>
            );
          })
        ) : (
          <p className="text-xs text-muted">
            {language === "ko"
              ? "아직 관련 게시글이 없습니다."
              : "No related posts yet."}
          </p>
        )}
      </div>
    </div>
  );
}

function CompanyIcon({
  logoUrl,
  name,
  symbol,
}: {
  logoUrl?: string | null;
  name: string;
  symbol: string;
}) {
  const initials = getInitials(name || symbol);
  const [logoFailed, setLogoFailed] = useState(false);

  if (logoUrl && !logoFailed) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="size-11 rounded-md border border-border bg-surface object-contain sm:size-10"
        onError={() => setLogoFailed(true)}
      />
    );
  }

  return <FallbackCompanyIcon initials={initials} />;
}

function FallbackCompanyIcon({ initials }: { initials: string }) {
  return (
    <div className="grid size-11 place-items-center rounded-md border border-border bg-primary/10 text-sm font-bold text-primary sm:size-10">
      {initials}
    </div>
  );
}

function getFallbackLogoUrl(weburl?: string): string | null {
  if (!weburl) {
    return null;
  }

  try {
    const url = new URL(
      weburl.startsWith("http") ? weburl : `https://${weburl}`,
    );
    return `https://logo.clearbit.com/${url.hostname.replace(/^www\./, "")}`;
  } catch {
    return null;
  }
}

function getInitials(value: string): string {
  const words = value
    .replace(/[^a-zA-Z0-9가-힣 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "-";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getRelatedPostPreview(post: CommunityPost): string {
  const text = htmlToPlainText(
    getPostHtml(post).replace(/<img\b[^>]*>/gi, " "),
  );
  return text || "본문 글 없음";
}

function RelatedNews({
  news,
  language,
}: {
  news: MarketNews[];
  language: Language;
}) {
  return (
    <div className="mt-2 rounded-md border border-border bg-surface-muted p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Newspaper size={14} className="text-primary" />
        {language === "ko"
          ? "이 종목의 최신 뉴스"
          : "Latest news for this stock"}
      </p>
      <div className="mt-2 space-y-2">
        {news.length ? (
          news.slice(0, 5).map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block border-t border-border pt-2 first:border-0 first:pt-0 hover:text-primary"
            >
              <p className="line-clamp-2 text-sm font-semibold">
                {item.translatedHeadline || item.headline}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {item.source} ·{" "}
                {new Date(item.datetime * 1000).toLocaleDateString()}
              </p>
            </a>
          ))
        ) : (
          <p className="text-xs text-muted">
            {language === "ko"
              ? "관련 최신 뉴스가 없습니다."
              : "No related news."}
          </p>
        )}
      </div>
    </div>
  );
}

function FinancialBarChart({
  financials,
  language,
  symbol,
  currency,
  sourceCurrency,
  exchangeRate,
  showMore,
}: {
  financials: NonNullable<StockDetail["financials"]>;
  language: Language;
  symbol: string;
  currency: DisplayCurrency;
  sourceCurrency: DisplayCurrency;
  exchangeRate: number | null;
  showMore: boolean;
}) {
  const rows = [...financials]
    .filter((item) => item.revenue !== null || item.operatingProfit !== null)
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
    .slice(-5);
  const maxValue = Math.max(
    ...rows.flatMap((item) => [
      Math.abs(
        convertFinancialValue(
          item.revenue,
          currency,
          sourceCurrency,
          exchangeRate,
        ) ?? 0,
      ),
      Math.abs(
        convertFinancialValue(
          item.operatingProfit,
          currency,
          sourceCurrency,
          exchangeRate,
        ) ?? 0,
      ),
    ]),
    0,
  );

  if (!rows.length || maxValue <= 0) {
    return null;
  }

  const title =
    language === "ko"
      ? `5개년 실적 (${currency})`
      : `5Y financials (${currency})`;
  const revenueLabel = language === "ko" ? "매출액" : "Revenue";
  const operatingProfitLabel =
    language === "ko" ? "영업이익" : "Operating profit";

  return (
    <div className="mt-5 rounded-md border border-border p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {showMore ? (
            <Link
              href={`/stocks/US/${encodeURIComponent(symbol)}/financials?currency=${currency}`}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {language === "ko" ? "\uB354\uBCF4\uAE30" : "More"}
            </Link>
          ) : null}
        </div>
        <div className="flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-primary" />
            {revenueLabel}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-positive" />
            {operatingProfitLabel}
          </span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-5 items-end gap-2 sm:gap-4">
        {rows.map((item) => {
          const revenueValue = convertFinancialValue(
            item.revenue,
            currency,
            sourceCurrency,
            exchangeRate,
          );
          const operatingProfitValue = convertFinancialValue(
            item.operatingProfit,
            currency,
            sourceCurrency,
            exchangeRate,
          );
          const revenueHeight = getFinancialBarHeight(revenueValue, maxValue);
          const operatingProfitHeight = getFinancialBarHeight(
            operatingProfitValue,
            maxValue,
          );

          return (
            <div key={item.fiscalYear} className="min-w-0">
              <div className="flex h-32 items-end justify-center gap-1 rounded-md bg-surface-muted px-2 py-2">
                <div
                  className="w-4 rounded-t-sm bg-primary sm:w-5"
                  style={{ height: `${revenueHeight}%` }}
                  title={`${revenueLabel}: ${formatFinancialAmount(item.revenue, currency, sourceCurrency, exchangeRate)}`}
                />
                <div
                  className="w-4 rounded-t-sm bg-positive sm:w-5"
                  style={{ height: `${operatingProfitHeight}%` }}
                  title={`${operatingProfitLabel}: ${formatFinancialAmount(
                    item.operatingProfit,
                    currency,
                    sourceCurrency,
                    exchangeRate,
                  )}`}
                />
              </div>
              <p className="mt-2 text-center text-xs font-semibold text-foreground">
                {financialPeriodLabel(item)}
              </p>
              <div className="mt-1 space-y-0.5 text-center text-[11px] text-muted">
                <p className="truncate">
                  {revenueLabel}{" "}
                  {formatFinancialAmount(
                    item.revenue,
                    currency,
                    sourceCurrency,
                    exchangeRate,
                  )}
                </p>
                <p className="truncate">
                  {operatingProfitLabel}{" "}
                  {formatFinancialAmount(
                    item.operatingProfit,
                    currency,
                    sourceCurrency,
                    exchangeRate,
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function financialPeriodLabel(
  item: NonNullable<StockDetail["financials"]>[number],
) {
  const middleDate = getFinancialPeriodMiddleDate(
    item.periodStart,
    item.periodEnd,
  );
  return String(middleDate?.getUTCFullYear() ?? item.fiscalYear);
}

function getFinancialPeriodMiddleDate(
  start: string | null | undefined,
  end: string | null | undefined,
) {
  const endDate = parseFinancialDate(end);
  if (!endDate) {
    return null;
  }

  const startDate = parseFinancialDate(start);
  if (!startDate) {
    return endDate;
  }

  return new Date((startDate.getTime() + endDate.getTime()) / 2);
}

function parseFinancialDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value.slice(0, 10) + "T00:00:00Z");
  return Number.isNaN(date.getTime()) ? null : date;
}

function getFinancialBarHeight(value: number | null, maxValue: number) {
  if (!value || maxValue <= 0) {
    return 4;
  }

  return Math.max(4, Math.min(100, (Math.abs(value) / maxValue) * 100));
}

function convertFinancialValue(
  value: number | null,
  currency: DisplayCurrency,
  sourceCurrency: DisplayCurrency,
  exchangeRate?: number | null,
) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  const converted = convertMoneyValue(
    value,
    currency,
    sourceCurrency,
    exchangeRate,
  );
  return Number.isFinite(converted) ? converted : null;
}

function formatFinancialAmount(
  value: number | null,
  currency: DisplayCurrency = "KRW",
  sourceCurrency: DisplayCurrency = currency,
  exchangeRate?: number | null,
) {
  const converted = convertFinancialValue(
    value,
    currency,
    sourceCurrency,
    exchangeRate,
  );
  if (converted === null) {
    return "-";
  }

  const abs = Math.abs(converted);
  const sign = converted < 0 ? "-" : "";
  if (currency === "USD") {
    if (abs >= 1_000_000_000_000)
      return `${sign}\$${formatFinancialDecimal(abs / 1_000_000_000_000)}T`;
    if (abs >= 1_000_000_000)
      return `${sign}\$${formatFinancialDecimal(abs / 1_000_000_000)}B`;
    if (abs >= 1_000_000)
      return `${sign}\$${formatFinancialDecimal(abs / 1_000_000)}M`;
    return `${sign}\$${formatFinancialDecimal(abs)}`;
  }
  if (abs >= 1_000_000_000_000) {
    return `${sign}${formatFinancialDecimal(abs / 1_000_000_000_000)}조`;
  }
  if (abs >= 100_000_000) {
    return `${sign}${formatFinancialDecimal(abs / 100_000_000)}억`;
  }

  return `${sign}${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(abs)}원`;
}

function formatFinancialDecimal(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
}

function formatNextEarnings(
  nextEarnings: StockDetail["nextEarnings"],
  language: "en" | "ko",
): string | null {
  if (!nextEarnings?.reportDate) {
    return null;
  }

  const hasActual =
    nextEarnings.epsActual !== null || nextEarnings.revenueActual !== null;
  if (hasActual) {
    const label = earningsPeriodLabel(nextEarnings);
    return language === "ko"
      ? label + " \uC2E4\uC801 \uBCF4\uAE30"
      : "View " + label + " earnings";
  }

  const date = new Date(nextEarnings.reportDate.slice(0, 10) + "T00:00:00");
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if (date < todayStart) {
    return null;
  }
  const formattedDate = new Intl.DateTimeFormat(
    language === "ko" ? "ko-KR" : "en-US",
    {
      month: "short",
      day: "numeric",
    },
  ).format(date);
  const time = formatEarningsTime(nextEarnings.timeOfTheDay, language);
  const estimate =
    nextEarnings.estimate !== null && nextEarnings.currency
      ? " \u00B7 EPS " +
        nextEarnings.estimate.toFixed(2) +
        " " +
        nextEarnings.currency
      : "";
  return (
    (language === "ko" ? "\uB2E4\uC74C \uC2E4\uC801 " : "Next earnings ") +
    formattedDate +
    " \u00B7 " +
    time +
    estimate
  );
}
function formatEarningsTime(
  timeOfTheDay: string | null | undefined,
  language: "en" | "ko",
): string {
  const normalized = timeOfTheDay?.trim().toLowerCase();
  if (!normalized) {
    return language === "ko" ? "\uC2DC\uAC04 \uBBF8\uC815" : "Time TBD";
  }

  const koLabels: Record<string, string> = {
    "pre-market": "\uD504\uB9AC\uB9C8\uCF13",
    premarket: "\uD504\uB9AC\uB9C8\uCF13",
    "before-market": "\uD504\uB9AC\uB9C8\uCF13",
    bmo: "\uD504\uB9AC\uB9C8\uCF13",
    "post-market": "\uC560\uD504\uD130\uB9C8\uCF13",
    postmarket: "\uC560\uD504\uD130\uB9C8\uCF13",
    "after-market": "\uC560\uD504\uD130\uB9C8\uCF13",
    "after hours": "\uC560\uD504\uD130\uB9C8\uCF13",
    amc: "\uC560\uD504\uD130\uB9C8\uCF13",
  };
  const enLabels: Record<string, string> = {
    "pre-market": "Pre-market",
    premarket: "Pre-market",
    "before-market": "Pre-market",
    bmo: "Pre-market",
    "post-market": "After-market",
    postmarket: "After-market",
    "after-market": "After-market",
    "after hours": "After-market",
    amc: "After-market",
  };

  return language === "ko"
    ? (koLabels[normalized] ?? timeOfTheDay ?? "\uC2DC\uAC04 \uBBF8\uC815")
    : (enLabels[normalized] ?? timeOfTheDay ?? "Time TBD");
}
function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface-muted p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

// 종목 상세 로딩 자리(종목 선택/전환 시). 실제 상세 레이아웃과 비슷한 높이로 시프트 방지.
function StockDetailSkeleton() {
  return (
    <div className="rounded-md border border-border p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="size-10 shrink-0 sm:size-12" />
      </div>
      <Skeleton className="mt-6 h-28 w-full" />
      <Skeleton className="mt-5 h-[260px] w-full" />
    </div>
  );
}
