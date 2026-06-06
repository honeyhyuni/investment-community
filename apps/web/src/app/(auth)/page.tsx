"use client";

import {
  useCallback,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LogOut,
  Moon,
  Sun,
  UserPen,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  BusinessDay,
  CandlestickData,
  CandlestickSeries,
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
} from "lightweight-charts";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Notice } from "@/common/components/Notice";
import { SessionLoading } from "@/common/components/SessionLoading";
import { useSessionStore } from "@/common/stores/session";
import { useMarketDataStore } from "@/common/stores/market-data";
import {
  DisplayCurrency,
  MarketQuote,
  StockSymbol,
  TradeTick,
} from "@/common/types";
import { CommunityPost } from "@/domain/community/types";
import { MarketPulse } from "@/domain/markets/components/MarketPulse";
import { useStockRouteSelection } from "@/domain/markets/hooks/useStockRouteSelection";

type View = "stocks";
type MenuView = View | "news" | "community" | "admin";
type Language = "en" | "ko";
type StockTab = "US" | "KR";

type StockDetail = {
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

type ChartPeriod = "1D" | "1M" | "1Y" | "3Y" | "5Y" | "ALL";

type CandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const chartPeriods: ChartPeriod[] = ["1D", "1M", "1Y", "3Y", "5Y", "ALL"];

const menus: Array<{ id: MenuView; label: string }> = [
  { id: "stocks", label: "Stocks" },
  { id: "news", label: "News" },
  { id: "community", label: "Community" },
  { id: "admin", label: "Admin" },
];

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

export default function Home() {
  return (
    <Suspense fallback={<SessionLoading />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const [view, setView] = useState<View>("stocks");
  const [language, setLanguage] = useState<Language>("en");
  const [stockTab, setStockTab] = useState<StockTab>("US");
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const authChecking = useSessionStore((s) => s.authChecking);
  const logoutSession = useSessionStore((s) => s.logout);
  const pulse = useMarketDataStore((s) => s.pulse);
  const usStocks = useMarketDataStore((s) => s.usStocks);
  const usSymbols = useMarketDataStore((s) => s.usSymbols);
  const krStocks = useMarketDataStore((s) => s.krStocks);
  const krSymbols = useMarketDataStore((s) => s.krSymbols);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const liveSeries = useMarketDataStore((s) => s.liveSeries);
  const marketLoading = useMarketDataStore((s) => s.marketLoading);
  const loadMarketData = useMarketDataStore((s) => s.loadMarketData);
  const router = useRouter();
  const [relatedPosts, setRelatedPosts] = useState<CommunityPost[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("1M");
  const [priceCurrency, setPriceCurrency] = useState<DisplayCurrency>("USD");
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("darkMode") === "true",
  );

  const isAdmin = user?.role === "ADMIN";
  const openStocksView = useCallback(() => setView("stocks"), []);

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
    if (!authChecking && user?.status !== "APPROVED") {
      router.replace("/login");
    }
  }, [authChecking, user?.status, router]);

  useEffect(() => {
    window.localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const visibleSymbols = useMemo(() => {
    const query = search.trim().toLowerCase();
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
      .filter(
        (item) =>
          item.symbol.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query),
      )
      .slice(0, 120);
  }, [search, usStocks, usSymbols]);

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

  function openRelatedPost(postId: string) {
    router.push(`/community?post=${encodeURIComponent(postId)}`);
  }

  async function loadStockDetail(symbol: string, token = accessToken) {
    if (!token) {
      return;
    }

    try {
      const detail = await apiRequest<StockDetail>(
        `/markets/stocks/detail?symbol=${encodeURIComponent(symbol)}&market=${stockTab === "KR" ? "KR" : "US"}`,
        "GET",
        { accessToken: token },
      );
      setStockDetail(detail);
    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : "Could not load stock detail.",
      );
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

    setChartLoading(true);
    try {
      const nextCandles = await apiRequest<CandlePoint[]>(
        `/markets/candles?symbol=${encodeURIComponent(symbol)}&period=${period}&market=${stockTab === "KR" ? "KR" : "US"}`,
        "GET",
        { accessToken: token },
      );
      setCandles(nextCandles);
    } catch (candleError) {
      setError(
        candleError instanceof Error
          ? candleError.message
          : "Could not load chart candles.",
      );
    } finally {
      setChartLoading(false);
    }
  }

  useEffect(() => {
    if (!accessToken || user?.status !== "APPROVED" || !selectedSymbol) {
      return;
    }

    queueMicrotask(() => {
      loadStockDetail(selectedSymbol, accessToken);
      loadCandles(selectedSymbol, chartPeriod, accessToken);
      loadRelatedPosts(selectedSymbol, accessToken);
    });
  }, [accessToken, selectedSymbol, chartPeriod, stockTab, user?.status]);

  async function logout() {
    // 세션 클리어 → user=null → 리다이렉트 가드가 /login으로 보냄(이 컴포넌트 언마운트되며 로컬 state 초기화).
    await logoutSession();
  }

  // 승인 전(로딩/비로그인/대기/거절)에는 로딩만 보여주고, 가드 effect가 /login으로 보냄.
  if (authChecking || user?.status !== "APPROVED") {
    return (
      <main
        className={`min-h-screen bg-[#f6f7fb] text-[#161a22] ${
          darkMode ? "dark-app" : ""
        }`}
      >
        <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
          <SessionLoading />
        </section>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen bg-[#f6f7fb] text-[#161a22] ${
        darkMode ? "dark-app" : ""
      }`}
    >
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-[#d9dee8] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#607086]">
              Private
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">
              Investment Community
            </h1>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLanguage(language === "en" ? "ko" : "en")}
                className="h-10 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold text-[#1f6f8b] shadow-sm hover:bg-[#eef1f6]"
              >
                {copy[language].translate}
              </button>
              <button
                onClick={() => setDarkMode((current) => !current)}
                title={darkMode ? "Light mode" : "Dark mode"}
                aria-label={darkMode ? "Light mode" : "Dark mode"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#c7ceda] bg-white text-[#344052] shadow-sm hover:bg-[#eef1f6]"
              >
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                onClick={() => router.push("/profile")}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold text-[#344052] shadow-sm hover:bg-[#eef1f6]"
              >
                <UserPen size={16} />
                {language === "ko" ? "프로필 수정" : "Profile"}
              </button>
              <button
                onClick={logout}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-medium shadow-sm hover:bg-[#eef1f6]"
              >
                <LogOut size={16} />
                {copy[language].logout}
              </button>
            </div>
          ) : null}
        </header>

        <>
            {error ? <Notice message="" error={error} /> : null}
            <MarketPulse
              pulse={pulse}
              livePrices={livePrices}
              loading={marketLoading}
              refresh={() => {
                if (accessToken) {
                  loadMarketData(accessToken);
                }
              }}
              title={copy[language].marketPulse}
              refreshLabel={copy[language].refresh}
            />
            <nav className="mt-4 flex gap-2 border-b border-[#d9dee8]">
              {menus
                .filter((menu) => menu.id !== "admin" || isAdmin)
                .map((menu) => (
                  <button
                    key={menu.id}
                    onClick={() => {
                      if (menu.id === "community") {
                        router.push("/community");
                        return;
                      }
                      if (menu.id === "news") {
                        router.push("/news");
                        return;
                      }
                      if (menu.id === "admin") {
                        router.push("/admin");
                        return;
                      }
                      setView(menu.id);
                    }}
                    className={`h-11 border-b-2 px-3 text-sm font-semibold ${
                      view === menu.id
                        ? "border-[#1f6f8b] text-[#1f6f8b]"
                        : "border-transparent text-[#607086]"
                    }`}
                  >
                    {copy[language][menu.id as keyof (typeof copy)["en"]] ??
                      menu.label}
                  </button>
                ))}
            </nav>
            <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[1fr]">
              <StocksView
                stockTab={stockTab}
                setStockTab={setStockTab}
                visibleSymbols={visibleSymbols}
                usStocks={usStocks}
                krStocks={krStocks}
                krSymbols={krSymbols}
                selectedSymbol={selectedSymbol}
                setSelectedSymbol={setSelectedSymbol}
                stockDetail={stockDetail}
                livePrices={livePrices}
                liveSeries={liveSeries}
                candles={candles}
                chartPeriod={chartPeriod}
                setChartPeriod={setChartPeriod}
                chartLoading={chartLoading}
                language={language}
                search={search}
                setSearch={setSearch}
                priceCurrency={priceCurrency}
                setPriceCurrency={setPriceCurrency}
                relatedPosts={relatedPosts}
                onRelatedPostClick={openRelatedPost}
              />
            </div>
          </>
      </section>
    </main>
  );
}

function StocksView({
  stockTab,
  setStockTab,
  visibleSymbols,
  usStocks,
  krStocks,
  krSymbols,
  selectedSymbol,
  setSelectedSymbol,
  stockDetail,
  livePrices,
  liveSeries,
  candles,
  chartPeriod,
  setChartPeriod,
  chartLoading,
  search,
  setSearch,
  language,
  priceCurrency,
  setPriceCurrency,
  relatedPosts,
  onRelatedPostClick,
}: {
  stockTab: StockTab;
  setStockTab: (tab: StockTab) => void;
  visibleSymbols: StockSymbol[];
  usStocks: MarketQuote[];
  krStocks: MarketQuote[];
  krSymbols: StockSymbol[];
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  stockDetail: StockDetail | null;
  livePrices: Record<string, TradeTick>;
  liveSeries: Record<string, TradeTick[]>;
  candles: CandlePoint[];
  chartPeriod: ChartPeriod;
  setChartPeriod: (period: ChartPeriod) => void;
  chartLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  language: Language;
  priceCurrency: DisplayCurrency;
  setPriceCurrency: (currency: DisplayCurrency) => void;
  relatedPosts: CommunityPost[];
  onRelatedPostClick: (postId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#eef1f6] pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{copy[language].stockList}</h2>
          <p className="mt-1 text-sm text-[#607086]">
            {copy[language].stockHint}
          </p>
        </div>
        <div className="grid grid-cols-2 rounded-md border border-[#d4dae5] bg-[#f3f5f9] p-1">
          <button
            onClick={() => {
              setStockTab("KR");
              setSelectedSymbol("005930");
              setPriceCurrency("KRW");
              setSearch("");
            }}
            className={`h-9 rounded px-3 text-sm font-semibold ${
              stockTab === "KR" ? "bg-white shadow-sm" : "text-[#607086]"
            }`}
          >
            {copy[language].korea}
          </button>
          <button
            onClick={() => {
              setStockTab("US");
              setSelectedSymbol("AAPL");
              setPriceCurrency("USD");
              setSearch("");
            }}
            className={`h-9 rounded px-3 text-sm font-semibold ${
              stockTab === "US" ? "bg-white shadow-sm" : "text-[#607086]"
            }`}
          >
            {copy[language].us}
          </button>
        </div>
      </div>

      {stockTab === "KR" ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
          <div>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#607086]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy[language].search}
                className="h-10 w-full rounded-md border border-[#c7ceda] pl-9 pr-3 text-sm outline-none focus:border-[#1f6f8b]"
              />
            </div>
            <div className="mt-3 max-h-[560px] overflow-auto rounded-md border border-[#d9dee8]">
              {krSymbols
                .filter((item) => {
                  const query = search.trim().toLowerCase();
                  if (!query) {
                    return true;
                  }
                  return (
                    item.symbol.toLowerCase().includes(query) ||
                    item.description.toLowerCase().includes(query)
                  );
                })
                .map((item) => {
                  const quote = krStocks.find((stock) => stock.symbol === item.symbol);
                  return (
                    <button
                      key={item.symbol}
                      onClick={() => setSelectedSymbol(item.symbol)}
                      className={`block w-full border-b border-[#eef1f6] px-3 py-3 text-left last:border-b-0 hover:bg-[#f6f8fb] ${
                        selectedSymbol === item.symbol ? "bg-[#eef6f8]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{item.description}</p>
                          <p className="truncate text-xs text-[#607086]">{item.symbol}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {quote ? formatMoney(quote.current, "KRW", quote.currency) : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
            </div>
            <RelatedPosts posts={relatedPosts} onPostClick={onRelatedPostClick} />
          </div>
          <StockDetailPanel
            detail={stockDetail}
            live={livePrices[selectedSymbol]}
            series={liveSeries[selectedSymbol] ?? []}
            candles={candles}
            chartPeriod={chartPeriod}
            setChartPeriod={setChartPeriod}
            chartLoading={chartLoading}
            language={language}
            priceCurrency="KRW"
            setPriceCurrency={setPriceCurrency}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
          <div>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#607086]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy[language].search}
                className="h-10 w-full rounded-md border border-[#c7ceda] pl-9 pr-3 text-sm outline-none focus:border-[#1f6f8b]"
              />
            </div>
            <div className="mt-3 max-h-[560px] overflow-auto rounded-md border border-[#d9dee8]">
              {visibleSymbols.map((item) => {
                const quote = usStocks.find((stock) => stock.symbol === item.symbol);
                const live = livePrices[item.symbol];
                return (
                  <button
                    key={item.symbol}
                    onClick={() => setSelectedSymbol(item.symbol)}
                    className={`block w-full border-b border-[#eef1f6] px-3 py-3 text-left last:border-b-0 hover:bg-[#f6f8fb] ${
                      selectedSymbol === item.symbol ? "bg-[#eef6f8]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{item.symbol}</p>
                        <p className="truncate text-xs text-[#607086]">
                          {item.description}
                        </p>
                      </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {live
                            ? formatMoney(
                                live.price,
                                priceCurrency,
                                item.currency === "KRW" ? "KRW" : "USD",
                              )
                            : quote
                              ? formatMoney(
                                  quote.current,
                                  priceCurrency,
                                  quote.currency ?? "USD",
                                )
                              : ""}
                        </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <RelatedPosts posts={relatedPosts} onPostClick={onRelatedPostClick} />
          </div>
          <StockDetailPanel
            detail={stockDetail}
            live={livePrices[selectedSymbol]}
            series={liveSeries[selectedSymbol] ?? []}
            candles={candles}
            chartPeriod={chartPeriod}
            setChartPeriod={setChartPeriod}
            chartLoading={chartLoading}
            language={language}
            priceCurrency={priceCurrency}
            setPriceCurrency={setPriceCurrency}
          />
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
  chartPeriod,
  setChartPeriod,
  chartLoading,
  language,
  priceCurrency,
  setPriceCurrency,
}: {
  detail: StockDetail | null;
  live?: TradeTick;
  series: TradeTick[];
  candles: CandlePoint[];
  chartPeriod: ChartPeriod;
  setChartPeriod: (period: ChartPeriod) => void;
  chartLoading: boolean;
  language: Language;
  priceCurrency: DisplayCurrency;
  setPriceCurrency: (currency: DisplayCurrency) => void;
}) {
  if (!detail) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-md border border-[#d9dee8] text-sm text-[#607086]">
        Select a stock.
      </div>
    );
  }

  const quote = live
    ? { ...detail.quote, current: live.price, timestamp: Math.floor(live.timestamp / 1000) }
    : detail.quote;
    const detailSourceCurrency = detail.profile.currency === "KRW" ? "KRW" : (detail.quote.currency ?? "USD");
    const displayMarketCap = detail.profile.marketCapitalization
    ? formatMarketCap(detail.profile.marketCapitalization, priceCurrency, detailSourceCurrency)
      : "-";
    const metricItems = buildMetricItems(detail.metrics, language, priceCurrency, detailSourceCurrency);
    const isKoreanMarket =
      detail.profile.currency === "KRW" && detail.profile.country === "대한민국";
    const valuationItems = [
    {
      label: translateDetailLabel(language, "marketCap"),
      value: displayMarketCap,
    },
    ...metricItems,
  ];

  return (
    <div className="rounded-md border border-[#d9dee8] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#607086]">{detail.profile.exchange}</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {detail.profile.name || detail.symbol}
          </h3>
          <p className="mt-1 text-sm text-[#607086]">
            {detail.symbol} · {detail.profile.finnhubIndustry || "Unknown sector"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isKoreanMarket ? (
            <button
              onClick={() =>
                setPriceCurrency(priceCurrency === "USD" ? "KRW" : "USD")
              }
              className="h-10 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold text-[#344052] hover:bg-[#eef1f6]"
            >
              {priceCurrency === "USD" ? "원" : "$"}
            </button>
          ) : null}
          {detail.profile.logo ? (
            <img
              src={detail.profile.logo}
              alt=""
              className="h-12 w-12 rounded-md border border-[#d9dee8] object-contain"
            />
          ) : null}
        </div>
      </div>
      <div className="mt-6">
        <QuoteCard quote={quote} live={!!live} displayCurrency={priceCurrency} />
      </div>
      <div className="mt-5 rounded-md border border-[#d9dee8] bg-[#f9fafc] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-[#344052]">
            {translateDetailLabel(language, "realtimeChart")}
          </p>
          <div className="flex flex-wrap gap-1">
            {chartPeriods.map((period) => (
              <button
                key={period}
                onClick={() => setChartPeriod(period)}
                className={`h-8 rounded-md px-2.5 text-xs font-semibold ${
                  chartPeriod === period
                    ? "bg-[#1f6f8b] text-white"
                    : "border border-[#c7ceda] bg-white text-[#344052]"
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        <>
          <RealtimeChart
            candles={candles}
            live={live}
            loading={chartLoading}
            period={chartPeriod}
          />
          <p className="mt-2 text-xs text-[#607086]">
            {series.length
              ? `${series.length} live ticks received`
              : "Live ticks update the last candle when available."}
          </p>
        </>
      </div>
      <div className="mt-5 rounded-md border border-[#d9dee8] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#344052]">
              {translateDetailLabel(language, "companyOverview")}
            </p>
            <p className="mt-1 text-xs text-[#607086]">
              {translateDetailLabel(language, "source")}: {detail.overview.source}
              {detail.overview.fetchedAt
                ? ` · ${new Date(detail.overview.fetchedAt).toLocaleDateString()}`
                : ""}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#344052]">
          {language === "en" ? detail.overview.en : detail.overview.ko}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
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
        <div className="mt-3 grid gap-3 md:grid-cols-2">
            <InfoBox
              label={translateDetailLabel(language, "open")}
              value={formatMoney(quote.open, priceCurrency, quote.currency)}
            />
            <InfoBox
              label={translateDetailLabel(language, "previousClose")}
              value={formatMoney(quote.previousClose, priceCurrency, quote.currency)}
            />
        </div>
      </div>
      <div className="mt-5 rounded-md border border-[#d9dee8] p-4">
        <p className="text-sm font-semibold text-[#344052]">
          {translateDetailLabel(language, "metrics")}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {valuationItems.map((item) => (
            <InfoBox key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RealtimeChart({
  candles,
  live,
  loading,
  period,
}: {
  candles: CandlePoint[];
  live?: TradeTick;
  loading: boolean;
  period: ChartPeriod;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      height: 220,
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

    chartRef.current = chart;
    seriesRef.current = series;

    const resize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
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
    chartRef.current?.timeScale().fitContent();
    chartRef.current?.applyOptions({
      timeScale: {
        timeVisible: period === "1D",
        secondsVisible: false,
      },
    });
  }, [candles, period]);

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
      {loading ? (
        <div className="absolute right-3 top-3 z-10 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-[#607086]">
          Loading
        </div>
      ) : null}
      <div ref={containerRef} className="h-[260px] w-full" />
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
}: {
  quote: MarketQuote;
  compact?: boolean;
  live?: boolean;
  displayCurrency?: DisplayCurrency;
}) {
  const positive = quote.change >= 0;
  const isIndex = quote.symbol.startsWith("KIS_INDEX:");
  const currentText = isIndex
    ? formatNumber(quote.current)
    : formatMoney(quote.current, displayCurrency, quote.currency);
  const changeText = isIndex
    ? formatNumber(quote.change)
    : formatMoney(quote.change, displayCurrency, quote.currency);
  return (
    <div className="rounded-md border border-[#d9dee8] bg-[#f9fafc] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{quote.name || quote.symbol}</p>
          <p className="text-xs text-[#607086]">{quote.symbol}</p>
        </div>
        {positive ? (
          <TrendingUp size={18} className="text-[#2e7d4f]" />
        ) : (
          <TrendingDown size={18} className="text-[#b64242]" />
        )}
      </div>
      <p className={compact ? "mt-2 text-xl font-semibold" : "mt-3 text-3xl font-semibold"}>
        {currentText}
      </p>
      <p
        className={`mt-1 text-sm font-medium ${
          positive ? "text-[#2e7d4f]" : "text-[#b64242]"
        }`}
      >
        {positive ? "+" : ""}
        {changeText} ({positive ? "+" : ""}
        {formatNumber(quote.percentChange)}%)
      </p>
      {live ? (
        <p className="mt-2 text-xs font-medium text-[#1f6f8b]">Live tick</p>
      ) : null}
    </div>
  );
}

function RelatedPosts({
  posts,
  onPostClick,
}: {
  posts: CommunityPost[];
  onPostClick: (postId: string) => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-[#d9dee8] bg-[#f9fafc] p-3">
      <p className="text-xs font-semibold text-[#344052]">이 종목과 관련된 피드</p>
      <div className="mt-2 space-y-2">
        {posts.length ? (
          posts.slice(0, 3).map((post) => (
            <button
              key={post.id}
              onClick={() => onPostClick(post.id)}
              className="block w-full cursor-pointer border-t border-[#eef1f6] pt-2 text-left first:border-0 first:pt-0"
            >
              <div className="flex items-baseline gap-2">
                <p className="max-w-[45%] truncate text-sm font-semibold">
                  {post.title || post.content}
                </p>
                <p className="min-w-0 flex-1 truncate text-[11px] text-[#607086]">
                  {post.contentBlocks.find((block) => block.type === "text")?.text || post.content}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-[#607086]">
                {post.author.nickname} · {new Date(post.createdAt).toLocaleDateString()}
              </p>
            </button>
          ))
        ) : (
          <p className="text-xs text-[#607086]">아직 관련 게시글이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#d9dee8] bg-[#f9fafc] p-3">
      <p className="text-xs text-[#607086]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function convertMoneyValue(
  value: number,
  displayCurrency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
) {
  if (displayCurrency === sourceCurrency) {
    return value;
  }

  if (displayCurrency === "KRW" && sourceCurrency === "USD") {
    return value * 1500;
  }

  if (displayCurrency === "USD" && sourceCurrency === "KRW") {
    return value / 1500;
  }

  return value;
}

function formatMoney(
  value: number,
  displayCurrency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
) {
  const converted = convertMoneyValue(value, displayCurrency, sourceCurrency);
  const symbol = displayCurrency === "KRW" ? "원" : "$";
  const fractionDigits = displayCurrency === "KRW" ? 0 : 2;

  return `${symbol}${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(converted || 0)}`;
}

function convertQuote(
  quote: MarketQuote,
  currency: DisplayCurrency,
): MarketQuote {
  if (!quote.currency || quote.currency === currency) {
    return quote;
  }

  return {
    ...quote,
    current: convertMoneyValue(quote.current, currency, quote.currency),
    change: convertMoneyValue(quote.change, currency, quote.currency),
    high: convertMoneyValue(quote.high, currency, quote.currency),
    low: convertMoneyValue(quote.low, currency, quote.currency),
    open: convertMoneyValue(quote.open, currency, quote.currency),
    previousClose: convertMoneyValue(quote.previousClose, currency, quote.currency),
  };
}

function formatMarketCap(
  value: number,
  displayCurrency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
) {
  const converted =
    sourceCurrency === "USD"
      ? convertMoneyValue(value * 1_000_000, displayCurrency, sourceCurrency)
      : convertMoneyValue(value, displayCurrency, sourceCurrency);

  if (displayCurrency === "KRW") {
    return formatKoreanLargeAmount(converted);
  }

  if (sourceCurrency === "USD") {
    return `${formatNumber(value)}M`;
  }

  return formatMoney(converted, displayCurrency, sourceCurrency);
}

function formatKoreanLargeAmount(value: number) {
  if (value >= 1_000_000_000_000) {
    return `${formatDecimal(value / 1_000_000_000_000)}조`;
  }

  if (value >= 100_000_000) {
    return `${formatDecimal(value / 100_000_000)}억`;
  }

  return `원${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))}`;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value);
}

function translateDetailLabel(
  language: Language,
  key:
    | "exchange"
    | "currency"
    | "marketCap"
    | "country"
    | "ipo"
    | "website"
    | "sharesOutstanding"
    | "open"
    | "previousClose"
    | "realtimeChart"
    | "companyOverview"
    | "source"
    | "metrics"
    | "per"
    | "pbr"
    | "eps"
    | "high52"
    | "low52"
    | "psr"
    | "roe"
    | "dividendYield",
) {
  const labels = {
    en: {
      exchange: "Exchange",
      currency: "Currency",
      marketCap: "Market cap",
      country: "Country",
      ipo: "IPO",
      website: "Website",
      sharesOutstanding: "Shares outstanding",
      open: "Open",
      previousClose: "Previous close",
      realtimeChart: "Realtime price chart",
      companyOverview: "Company overview",
      source: "Source",
      metrics: "Valuation",
      per: "PER",
      pbr: "PBR",
      eps: "EPS",
      high52: "52W High",
      low52: "52W Low",
      psr: "PSR",
      roe: "ROE",
      dividendYield: "Dividend yield",
    },
    ko: {
      exchange: "거래소",
      currency: "통화",
      marketCap: "시가총액",
      country: "국가",
      ipo: "상장일",
      website: "웹사이트",
      sharesOutstanding: "발행주식수",
      open: "시가",
      previousClose: "전일종가",
      realtimeChart: "실시간 차트",
      companyOverview: "회사 개요",
      source: "출처",
      metrics: "밸류에이션",
      per: "PER",
      pbr: "PBR",
      eps: "EPS",
      high52: "52주 고가",
      low52: "52주 저가",
      psr: "PSR",
      roe: "ROE",
      dividendYield: "배당수익률",
    },
  } as const;

  return labels[language][key];
}

function buildMetricItems(
  metrics: Record<string, number | string | null | undefined> | null,
  language: Language,
  currency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
) {
  return [
    {
      label: translateDetailLabel(language, "per"),
      value: formatRatio(
        pickMetric(metrics, ["peTTM", "peAnnual", "peRatioTTM", "peRatio"]),
      ),
    },
    {
      label: translateDetailLabel(language, "pbr"),
      value: formatRatio(
        pickMetric(metrics, ["pbAnnual", "pbTTM", "pbRatioAnnual", "pbRatio"]),
      ),
    },
      {
        label: translateDetailLabel(language, "eps"),
        value: formatMoneyValue(
          pickMetric(metrics, ["epsTTM", "epsAnnual", "epsBasicExclExtraTTM"]),
          currency,
          sourceCurrency,
        ),
      },
      {
        label: translateDetailLabel(language, "high52"),
        value: formatMoneyValue(pickMetric(metrics, ["52WeekHigh"]), currency, sourceCurrency),
      },
      {
        label: translateDetailLabel(language, "low52"),
        value: formatMoneyValue(pickMetric(metrics, ["52WeekLow"]), currency, sourceCurrency),
      },
    {
      label: translateDetailLabel(language, "psr"),
      value: formatRatio(
        pickMetric(metrics, ["psTTM", "psAnnual", "psRatioTTM", "psRatio"]),
      ),
    },
    {
      label: translateDetailLabel(language, "roe"),
      value: formatPercentValue(
        pickMetric(metrics, ["roeTTM", "roeAnnual", "returnOnEquityTTM"]),
      ),
    },
    {
      label: translateDetailLabel(language, "dividendYield"),
      value: formatPercentValue(
        pickMetric(metrics, ["currentDividendYieldTTM", "dividendYieldTTM"]),
      ),
    },
  ];
}

function pickMetric(
  metrics: Record<string, number | string | null | undefined> | null,
  keys: string[],
): number | null {
  if (!metrics) {
    return null;
  }

  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function formatRatio(value: number | null): string {
  return value === null ? "-" : `${value.toFixed(2)}x`;
}

function formatPercentValue(value: number | null): string {
  return value === null ? "-" : `${value.toFixed(2)}%`;
}

function formatMoneyValue(
  value: number | null,
  currency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
): string {
  return value === null ? "-" : formatMoney(value, currency, sourceCurrency);
}
