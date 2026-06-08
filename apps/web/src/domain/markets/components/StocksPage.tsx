"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
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
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/common/lib/api";
import { Notice } from "@/common/components/Notice";
import { useSessionStore } from "@/common/stores/session";
import { useMarketDataStore } from "@/common/stores/market-data";
import { usePreferencesStore } from "@/common/stores/preferences";
import { formatMoney, formatNumber } from "@/common/utils/format";
import { applyLiveTrade } from "@/common/utils/market";
import {
  DisplayCurrency,
  Language,
  MarketQuote,
  StockSymbol,
  TradeTick,
} from "@/common/types";
import { CommunityPost } from "@/domain/community/types";
import { useStockRouteSelection } from "@/domain/markets/hooks/useStockRouteSelection";
import {
  buildMetricItems,
  formatMarketCap,
  translateDetailLabel,
} from "@/domain/markets/utils/format";
import {
  CandlePoint,
  ChartPeriod,
  MarketNews,
  StockDetail,
  StockTab,
} from "@/domain/markets/types";

const chartPeriods: ChartPeriod[] = ["1D", "1M", "1Y", "3Y", "5Y", "ALL"];

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
  const noticeMessage =
    notice === "profile-updated" ? "저장 완료되었습니다." : "";
  const initialMarket: StockTab =
    searchParams.get("market")?.toUpperCase() === "KR" ? "KR" : "US";
  const initialSymbol =
    searchParams.get("symbol")?.trim().toUpperCase() ||
    (initialMarket === "KR" ? "005930" : "AAPL");
  const [stockTab, setStockTab] = useState<StockTab>(initialMarket);
  const accessToken = useSessionStore((s) => s.accessToken);
  const language = usePreferencesStore((s) => s.language);
  const usStocks = useMarketDataStore((s) => s.usStocks);
  const usSymbols = useMarketDataStore((s) => s.usSymbols);
  const krStocks = useMarketDataStore((s) => s.krStocks);
  const krSymbols = useMarketDataStore((s) => s.krSymbols);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const liveSeries = useMarketDataStore((s) => s.liveSeries);
  const exchangeRate = useMarketDataStore((s) => s.exchangeRate);
  const router = useRouter();
  const [relatedPosts, setRelatedPosts] = useState<CommunityPost[]>([]);
  const [stockNews, setStockNews] = useState<MarketNews[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("1M");
  const [priceCurrency, setPriceCurrency] = useState<DisplayCurrency>(
    initialMarket === "KR" ? "KRW" : "USD",
  );
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const detailRequestIdRef = useRef(0);

  // 셸(레이아웃)에서 stocks가 곧 기본 라우트라 별도 전환 불필요.
  const openStocksView = useCallback(() => {}, []);

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

  const visibleKrSymbols = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return krSymbols.slice(0, 80);
    }

    return krSymbols
      .filter(
        (item) =>
          item.symbol.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query),
      )
      .slice(0, 120);
  }, [krSymbols, search]);

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

  function openRelatedPost(postId: string) {
    router.push(`/community?post=${encodeURIComponent(postId)}`);
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

  return (
    <>
      {noticeMessage ? <Notice message={noticeMessage} error="" /> : null}
      {error ? <Notice message="" error={error} /> : null}
      <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[1fr]">
              <StocksView
                stockTab={stockTab}
                setStockTab={setStockTab}
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
                chartPeriod={chartPeriod}
                setChartPeriod={setChartPeriod}
                chartLoading={chartLoading}
                language={language}
                search={search}
                setSearch={setSearch}
                priceCurrency={priceCurrency}
                setPriceCurrency={setPriceCurrency}
                relatedPosts={relatedPosts}
                stockNews={stockNews}
                onRelatedPostClick={openRelatedPost}
                exchangeRate={exchangeRate}
              />
            </div>
    </>
  );
}

function StocksView({
  stockTab,
  setStockTab,
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
  chartPeriod,
  setChartPeriod,
  chartLoading,
  search,
  setSearch,
  language,
  priceCurrency,
  setPriceCurrency,
  relatedPosts,
  stockNews,
  onRelatedPostClick,
  exchangeRate,
}: {
  stockTab: StockTab;
  setStockTab: (tab: StockTab) => void;
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
  chartPeriod: ChartPeriod;
  setChartPeriod: (period: ChartPeriod) => void;
  chartLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  language: Language;
  priceCurrency: DisplayCurrency;
  setPriceCurrency: (currency: DisplayCurrency) => void;
  relatedPosts: CommunityPost[];
  stockNews: MarketNews[];
  onRelatedPostClick: (postId: string) => void;
  exchangeRate: number | null;
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
              {visibleKrSymbols.map((item) => {
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
                          {quote
                            ? formatMoney(quote.current, "KRW", quote.currency, exchangeRate)
                            : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
            </div>
            <RelatedPosts posts={relatedPosts} onPostClick={onRelatedPostClick} />
            <RelatedNews news={stockNews} />
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
            exchangeRate={exchangeRate}
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
                                exchangeRate,
                              )
                            : quote
                              ? formatMoney(
                                  quote.current,
                                  priceCurrency,
                                  quote.currency ?? "USD",
                                  exchangeRate,
                                )
                              : ""}
                        </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <RelatedPosts posts={relatedPosts} onPostClick={onRelatedPostClick} />
            <RelatedNews news={stockNews} />
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
            exchangeRate={exchangeRate}
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
  exchangeRate,
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
  exchangeRate: number | null;
}) {
  if (!detail) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-md border border-[#d9dee8] text-sm text-[#607086]">
        Select a stock.
      </div>
    );
  }

  const quote = applyLiveTrade(detail.quote, live);
    const detailSourceCurrency = detail.profile.currency === "KRW" ? "KRW" : (detail.quote.currency ?? "USD");
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
        <QuoteCard
          quote={quote}
          live={!!live}
          displayCurrency={priceCurrency}
          exchangeRate={exchangeRate}
        />
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
              value={formatMoney(quote.open, priceCurrency, quote.currency, exchangeRate)}
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
  exchangeRate,
}: {
  quote: MarketQuote;
  compact?: boolean;
  live?: boolean;
  displayCurrency?: DisplayCurrency;
  exchangeRate?: number | null;
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

function RelatedNews({ news }: { news: MarketNews[] }) {
  return (
    <div className="mt-3 rounded-md border border-[#d9dee8] bg-[#f9fafc] p-3">
      <p className="text-xs font-semibold text-[#344052]">이 종목의 최신 뉴스</p>
      <div className="mt-2 space-y-2">
        {news.length ? (
          news.slice(0, 5).map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block border-t border-[#eef1f6] pt-2 first:border-0 first:pt-0 hover:text-[#1f6f8b]"
            >
              <p className="line-clamp-2 text-sm font-semibold">
                {item.translatedHeadline || item.headline}
              </p>
              <p className="mt-0.5 text-xs text-[#607086]">
                {item.source} · {new Date(item.datetime * 1000).toLocaleDateString()}
              </p>
            </a>
          ))
        ) : (
          <p className="text-xs text-[#607086]">관련 최신 뉴스가 없습니다.</p>
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

