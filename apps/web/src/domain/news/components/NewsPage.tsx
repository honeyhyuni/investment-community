"use client";

import { useCallback, useEffect, useState } from "react";
import { Notice } from "@/common/components/Notice";
import { usePreferencesStore } from "@/common/stores/preferences";
import { useSessionStore } from "@/common/stores/session";
import { apiRequest } from "@/common/lib/api";
import { MarketNews, NewsCategory } from "@/domain/news/types";

const newsCategories: Array<{ id: NewsCategory; label: string }> = [
  { id: "us", label: "미국뉴스" },
  { id: "kr", label: "한국뉴스" },
];

export function NewsPage() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const language = usePreferencesStore((s) => s.language);

  const [news, setNews] = useState<MarketNews[]>([]);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<NewsCategory>("us");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadNews = useCallback(async (token = accessToken, nextCategory: NewsCategory = category) => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const newsLanguage = nextCategory === "us" ? "ko" : language;
      const nextNews = await apiRequest<MarketNews[]>(
        `/markets/news?market=${nextCategory === "kr" ? "KR" : "US"}&language=${newsLanguage}`,
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
  }, [accessToken, category, language]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    queueMicrotask(() => {
      loadNews(accessToken, category);
    });
  }, [accessToken, category, loadNews]);

  return (
    <>
      {error ? <Notice message="" error={error} /> : null}

      <div className="grid flex-1 gap-4 py-4 sm:gap-6 sm:py-6 lg:grid-cols-[1fr]">
        <NewsList
          news={news}
          loading={loading}
          page={page}
          setPage={setPage}
          category={category}
          setCategory={setCategory}
          language={language}
          title={language === "ko" ? "뉴스" : "News"}
        />
      </div>
    </>
  );
}

function NewsList({
  news,
  loading,
  page,
  setPage,
  category,
  setCategory,
  language,
  title,
}: {
  news: MarketNews[];
  loading: boolean;
  page: number;
  setPage: (page: number) => void;
  category: NewsCategory;
  setCategory: (category: NewsCategory) => void;
  language: "en" | "ko";
  title: string;
}) {
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(news.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleNews = news.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section className="-mx-4 border-y border-[#d9dee8] bg-white p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
        <span className="rounded-md bg-[#eef3f8] px-2.5 py-1 text-xs font-semibold text-[#344052]">
          {news.length}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
        {newsCategories.map((item) => (
          <button
            key={item.id}
            onClick={() => setCategory(item.id)}
            className={`h-10 rounded-md px-3 text-sm font-semibold sm:h-9 ${
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
              className="block rounded-md border border-[#d9dee8] p-3 hover:bg-[#f6f8fb] sm:p-4"
            >
              <div className="flex gap-3 sm:gap-4">
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    className="h-20 w-24 shrink-0 rounded-md object-cover sm:h-20 sm:w-28"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#607086] sm:text-xs">
                    {item.source} · {new Date(item.datetime * 1000).toLocaleString()}
                  </p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 sm:text-base sm:leading-6">
                    {item.translatedHeadline || item.headline}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#607086] sm:text-sm sm:leading-6">
                    {item.summary}
                  </p>
                </div>
              </div>
            </a>
          ))
        )}
      </div>
      {news.length > pageSize ? (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eef1f6] pt-4">
          <button
            disabled={safePage === 1}
            onClick={() => setPage(Math.max(1, safePage - 1))}
            className="h-10 rounded-md border border-[#c7ceda] px-3 text-sm font-semibold disabled:opacity-50 sm:h-9"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-[#607086]">
            {safePage} / {totalPages}
          </span>
          <button
            disabled={safePage === totalPages}
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            className="h-10 rounded-md border border-[#c7ceda] px-3 text-sm font-semibold disabled:opacity-50 sm:h-9"
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
