"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun, UserPen } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { SessionLoading } from "@/common/components/SessionLoading";
import { useMarketDataStore } from "@/common/stores/market-data";
import { useSessionStore } from "@/common/stores/session";
import { apiRequest } from "@/lib/api";
import { MarketPulse } from "@/domain/markets/components/MarketPulse";
import { MarketNews, NewsCategory } from "@/domain/news/types";

const newsCategories: Array<{ id: NewsCategory; label: string }> = [
  { id: "us", label: "미국뉴스" },
  { id: "kr", label: "한국뉴스" },
];

export function NewsPage() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const authChecking = useSessionStore((s) => s.authChecking);
  const logoutSession = useSessionStore((s) => s.logout);
  const pulse = useMarketDataStore((s) => s.pulse);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const marketLoading = useMarketDataStore((s) => s.marketLoading);
  const loadMarketData = useMarketDataStore((s) => s.loadMarketData);

  const [news, setNews] = useState<MarketNews[]>([]);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<NewsCategory>("us");
  const [language, setLanguage] = useState<"en" | "ko">("en");
  const [darkMode, setDarkMode] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("darkMode") === "true",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = user?.role === "ADMIN";
  const menuItems: Array<{ id: "stocks" | "news" | "community" | "admin"; label: string }> = [
    { id: "stocks", label: language === "ko" ? "종목" : "Stocks" },
    { id: "news", label: language === "ko" ? "뉴스" : "News" },
    { id: "community", label: language === "ko" ? "커뮤니티" : "Community" },
    { id: "admin", label: language === "ko" ? "관리자" : "Admin" },
  ];

  useEffect(() => {
    if (!authChecking && user?.status !== "APPROVED") {
      router.replace("/login");
    }
  }, [authChecking, user?.status, router]);

  useEffect(() => {
    window.localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const loadNews = useCallback(async (token = accessToken, nextCategory: NewsCategory = category) => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const nextNews = await apiRequest<MarketNews[]>(
        `/markets/news?market=${nextCategory === "kr" ? "KR" : "US"}`,
        "GET",
        { accessToken: token },
      );
      setNews(nextNews.slice(0, 100));
      setPage(1);
    } catch (newsError) {
      setError(newsError instanceof Error ? newsError.message : "Could not load news.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, category]);

  useEffect(() => {
    if (!accessToken || user?.status !== "APPROVED") {
      return;
    }
    queueMicrotask(() => {
      loadNews(accessToken, category);
    });
  }, [accessToken, user?.status, category, loadNews]);

  async function logout() {
    await logoutSession();
  }

  if (authChecking || user?.status !== "APPROVED") {
    return (
      <main className={`min-h-screen bg-[#f6f7fb] text-[#161a22] ${darkMode ? "dark-app" : ""}`}>
        <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
          <SessionLoading />
        </section>
      </main>
    );
  }

  return (
    <main className={`min-h-screen bg-[#f6f7fb] text-[#161a22] ${darkMode ? "dark-app" : ""}`}>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === "en" ? "ko" : "en")}
              className="h-10 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold text-[#1f6f8b] shadow-sm hover:bg-[#eef1f6]"
            >
              {language === "en" ? "한국어" : "English"}
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
              onClick={() => router.push("/")}
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
              {language === "ko" ? "로그아웃" : "Logout"}
            </button>
          </div>
        </header>

        <MarketPulse
          pulse={pulse}
          livePrices={livePrices}
          loading={marketLoading}
          refresh={() => {
            if (accessToken) {
              loadMarketData(accessToken);
            }
          }}
          title={language === "ko" ? "시장 지표" : "Market pulse"}
          refreshLabel={language === "ko" ? "새로고침" : "Refresh"}
        />

        <nav className="mt-4 flex gap-2 border-b border-[#d9dee8]">
          {menuItems
            .filter((item) => item.id !== "admin" || isAdmin)
            .map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "news") {
                    return;
                  }
                  if (item.id === "community") {
                    router.push("/community");
                    return;
                  }
                  router.push("/");
                }}
                className={`h-11 border-b-2 px-3 text-sm font-semibold ${
                  item.id === "news"
                    ? "border-[#1f6f8b] text-[#1f6f8b]"
                    : "border-transparent text-[#607086]"
                }`}
              >
                {item.label}
              </button>
            ))}
        </nav>

        {error ? <Notice message="" error={error} /> : null}

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[1fr]">
          <NewsList
            news={news}
            loading={loading}
            page={page}
            setPage={setPage}
            category={category}
            setCategory={setCategory}
            title={language === "ko" ? "뉴스" : "News"}
          />
        </div>
      </section>
    </main>
  );
}

function NewsList({
  news,
  loading,
  page,
  setPage,
  category,
  setCategory,
  title,
}: {
  news: MarketNews[];
  loading: boolean;
  page: number;
  setPage: (page: number) => void;
  category: NewsCategory;
  setCategory: (category: NewsCategory) => void;
  title: string;
}) {
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(news.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleNews = news.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span className="rounded-md bg-[#eef3f8] px-2.5 py-1 text-xs font-semibold text-[#344052]">
          {news.length}
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        {newsCategories.map((item) => (
          <button
            key={item.id}
            onClick={() => setCategory(item.id)}
            className={`h-9 rounded-md px-3 text-sm font-semibold ${
              category === item.id
                ? "bg-[#1f6f8b] text-white"
                : "border border-[#c7ceda] bg-white text-[#344052]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        {loading && news.length === 0 ? (
          <p className="rounded-md border border-[#d9dee8] p-6 text-center text-sm text-[#607086]">
            불러오는 중입니다.
          </p>
        ) : null}
        {!loading && news.length === 0 ? (
          <p className="rounded-md border border-[#d9dee8] p-6 text-center text-sm text-[#607086]">
            No news loaded.
          </p>
        ) : (
          visibleNews.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border border-[#d9dee8] p-4 hover:bg-[#f6f8fb]"
            >
              <div className="flex gap-4">
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    className="hidden h-20 w-28 rounded-md object-cover sm:block"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#607086]">
                    {item.source} · {new Date(item.datetime * 1000).toLocaleString()}
                  </p>
                  <h3 className="mt-1 font-semibold">{item.headline}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#607086]">
                    {item.summary}
                  </p>
                </div>
              </div>
            </a>
          ))
        )}
      </div>
      {news.length > pageSize ? (
        <div className="mt-4 flex items-center justify-between border-t border-[#eef1f6] pt-4">
          <button
            disabled={safePage === 1}
            onClick={() => setPage(Math.max(1, safePage - 1))}
            className="h-9 rounded-md border border-[#c7ceda] px-3 text-sm font-semibold disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-[#607086]">
            {safePage} / {totalPages}
          </span>
          <button
            disabled={safePage === totalPages}
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            className="h-9 rounded-md border border-[#c7ceda] px-3 text-sm font-semibold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
