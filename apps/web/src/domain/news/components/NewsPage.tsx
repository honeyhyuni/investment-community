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

      <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[1fr]">
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
                  <h3 className="mt-1 font-semibold">
                    {item.translatedHeadline || item.headline}
                  </h3>
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
