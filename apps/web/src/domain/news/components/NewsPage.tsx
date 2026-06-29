'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Notice } from '@/common/components/Notice';
import { Button } from '@/common/components/Button';
import { SegmentedControl } from '@/common/components/SegmentedControl';
import { Skeleton } from '@/common/components/Skeleton';
import { usePreferencesStore } from '@/common/stores/preferences';
import { useSessionStore } from '@/common/stores/session';
import { apiRequest } from '@/common/lib/api';
import { MarketNews, NewsCategory } from '@/domain/news/types';

const newsCategories: Array<{
  id: NewsCategory;
  label: Record<'en' | 'ko', string>;
}> = [
  { id: 'us', label: { ko: '미국뉴스', en: 'US News' } },
  { id: 'kr', label: { ko: '한국뉴스', en: 'Korea News' } },
];

export function NewsPage() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const language = usePreferencesStore((s) => s.language);

  const [news, setNews] = useState<MarketNews[]>([]);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<NewsCategory>('us');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadNews = useCallback(
    async (token = accessToken, nextCategory: NewsCategory = category) => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError('');
      try {
        const newsLanguage = nextCategory === 'us' ? 'ko' : language;
        const nextNews = await apiRequest<MarketNews[]>(
          `/markets/news?market=${nextCategory === 'kr' ? 'KR' : 'US'}&language=${newsLanguage}`,
          'GET',
          { accessToken: token },
        );
        setNews(nextNews.slice(0, 100));
        setPage(1);
      } catch (newsError) {
        setError(
          newsError instanceof Error
            ? newsError.message
            : 'Could not load news.',
        );
      } finally {
        setLoading(false);
      }
    },
    [accessToken, category, language],
  );

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
}: {
  news: MarketNews[];
  loading: boolean;
  page: number;
  setPage: (page: number) => void;
  category: NewsCategory;
  setCategory: (category: NewsCategory) => void;
  language: 'en' | 'ko';
}) {
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(news.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleNews = news.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <section className="min-w-0">
      <SegmentedControl
        className="sm:inline-flex"
        aria-label={language === 'ko' ? '뉴스 지역' : 'News region'}
        options={newsCategories.map((item) => ({
          value: item.id,
          label: item.label[language],
        }))}
        value={category}
        onChange={setCategory}
      />
      <div className="mt-4 grid gap-3">
        {loading ? (
          // 탭 전환·첫 로드 모두 카드와 동일한 크기의 스켈레톤을 한 페이지 분량 렌더해
          // 레이아웃 시프트와 이전 탭 잔상 노출을 막는다.
          Array.from({ length: pageSize }).map((_, index) => (
            <NewsCardSkeleton key={index} />
          ))
        ) : news.length === 0 ? (
          <p className="rounded-md border border-[#d9dee8] p-6 text-center text-sm text-[#607086]">
            {language === 'ko' ? '표시할 뉴스가 없습니다.' : 'No news loaded.'}
          </p>
        ) : (
          visibleNews.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border border-[#d9dee8] p-3 shadow-sm transition-all duration-150 ease-out will-change-transform hover:scale-[1.01] hover:bg-[#f6f8fb] hover:shadow-md sm:p-4"
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
                    {item.source} ·{' '}
                    {new Date(item.datetime * 1000).toLocaleString()}
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
      {!loading && news.length > pageSize ? (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eef1f6] pt-4">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ChevronLeft />}
            disabled={safePage === 1}
            onClick={() => setPage(Math.max(1, safePage - 1))}
          >
            {language === 'ko' ? '이전' : 'Previous'}
          </Button>
          <span className="text-sm font-medium text-[#607086]">
            {safePage} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            rightIcon={<ChevronRight />}
            disabled={safePage === totalPages}
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
          >
            {language === 'ko' ? '다음' : 'Next'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

// 실제 뉴스 카드(이미지 h-20 + 제목 2줄 + 요약 2줄)와 같은 크기·보더로 맞춰
// 스켈레톤 → 실제 카드 전환 시 높이 점프가 없게 한다.
function NewsCardSkeleton() {
  return (
    <div className="rounded-md border border-border bg-surface p-3 sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <Skeleton className="h-20 w-24 shrink-0 sm:w-28" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-1.5 h-4 w-11/12" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}
