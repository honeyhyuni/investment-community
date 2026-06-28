'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
} from 'lucide-react';
import { apiRequest } from '@/common/lib/api';
import { Notice } from '@/common/components/Notice';
import { SegmentedControl } from '@/common/components/SegmentedControl';
import { Skeleton } from '@/common/components/Skeleton';
import { useMarketDataStore } from '@/common/stores/market-data';
import { usePreferencesStore } from '@/common/stores/preferences';
import { useSessionStore } from '@/common/stores/session';
import { StockSymbol } from '@/common/types';
import { stockSearchScore } from '@/common/utils/stock-search';
import {
  IpoCalendarItem,
  UsEarningsCalendarBounds,
  UsEarningsCalendarItem,
} from '@/domain/ipo/types';

type CalendarTab = 'ipo' | 'earnings';
type EarningsView = 'daily' | 'weekly' | 'monthly';

type CalendarDay = {
  date: string;
  label: string;
  weekday: string;
  events: IpoCalendarEvent[];
};

type IpoCalendarEvent = {
  item: IpoCalendarItem;
  type: 'subscription' | 'listing';
};

type EarningsCalendarDay = {
  date: string;
  day: number;
  weekday: string;
  inMonth: boolean;
  events: UsEarningsCalendarItem[];
};

export function IpoCalendarPage({
  initialTab = 'ipo',
}: {
  initialTab?: CalendarTab;
}) {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const language = usePreferencesStore((s) => s.language);
  const [activeTab, setActiveTab] = useState<CalendarTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  function switchTab(tab: CalendarTab) {
    setActiveTab(tab);
    router.push(tab === 'earnings' ? '/calendar/earnings' : '/calendar/ipo');
  }

  return (
    <div className="grid min-w-0 flex-1 gap-4 py-4 sm:gap-6 sm:py-6">
      <section className="min-w-0">
        <div className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl<CalendarTab>
            className="w-full sm:inline-flex sm:w-auto"
            aria-label={language === 'ko' ? '캘린더 선택' : 'Calendar view'}
            options={[
              {
                value: 'ipo',
                label: (
                  <span className="flex flex-col items-center leading-tight">
                    <span>{language === 'ko' ? '공모주' : 'IPO'}</span>
                    <span className="text-[11px] font-medium opacity-80">
                      {language === 'ko' ? '청약/상장' : 'Subscription'}
                    </span>
                  </span>
                ),
              },
              {
                value: 'earnings',
                label: (
                  <span className="flex flex-col items-center leading-tight">
                    <span>
                      {language === 'ko' ? '미국실적' : 'US Earnings'}
                    </span>
                    <span className="text-[11px] font-medium opacity-80">
                      {language === 'ko' ? '발표 일정' : 'Calendar'}
                    </span>
                  </span>
                ),
              },
            ]}
            value={activeTab}
            onChange={switchTab}
          />
        </div>

        {activeTab === 'ipo' ? (
          <IpoCalendarSection accessToken={accessToken} language={language} />
        ) : (
          <UsEarningsSection accessToken={accessToken} language={language} />
        )}
      </section>
    </div>
  );
}

function IpoCalendarSection({
  accessToken,
  language,
}: {
  accessToken: string | null;
  language: 'en' | 'ko';
}) {
  const [items, setItems] = useState<IpoCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    apiRequest<IpoCalendarItem[]>('/markets/ipos', 'GET', { accessToken })
      .then((nextItems) => {
        if (active) {
          setItems(nextItems);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : language === 'ko'
                ? '공모주 일정을 불러오지 못했습니다.'
                : 'Could not load IPO calendar.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, language]);

  const calendarDays = useMemo(
    () => buildRollingCalendar(items, language),
    [items, language],
  );

  return (
    <div className="pt-4">
      {error ? <Notice message="" error={error} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="hidden">
          {language === 'ko'
            ? 'DART 공시와 상장 일정 데이터를 매일 새벽 3시에 갱신합니다.'
            : 'Updated daily at 3 AM from DART disclosures and listing schedules.'}
        </p>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <CalendarDays size={14} />
          {items.length}
        </span>
      </div>

      {loading ? (
        <IpoCalendarSkeleton />
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {calendarDays.map((day) => (
              <div
                key={day.date}
                className="min-h-32 min-w-0 rounded-md border border-border bg-surface-muted p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {day.label}
                    </p>
                    <p className="text-xs font-medium text-muted">
                      {day.weekday}
                    </p>
                  </div>
                  {day.events.length ? (
                    <span className="rounded-full bg-positive/10 px-2 py-0.5 text-xs font-semibold text-positive">
                      {day.events.length}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2">
                  {day.events.length ? (
                    day.events.map((event) => (
                      <IpoCompactCard
                        key={`${event.item.id}-${event.type}`}
                        event={event}
                        language={language}
                      />
                    ))
                  ) : (
                    <p className="rounded-md border border-dashed border-border px-2 py-4 text-center text-xs text-muted">
                      {language === 'ko' ? '일정 없음' : 'No IPOs'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <h2 className="text-base font-semibold text-foreground">
              {language === 'ko' ? '공모주 목록' : 'IPO list'}
            </h2>
            <div className="mt-3 grid gap-3">
              {items.length ? (
                items.map((item) => (
                  <IpoListCard key={item.id} item={item} language={language} />
                ))
              ) : (
                <p className="rounded-md border border-dashed border-border bg-surface-muted px-4 py-10 text-center text-sm text-muted">
                  {language === 'ko'
                    ? '오늘 기준 한 달 이내로 파싱된 공모주 일정이 없습니다.'
                    : 'No parsed IPO schedules for the next month.'}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UsEarningsSection({
  accessToken,
  language,
}: {
  accessToken: string | null;
  language: 'en' | 'ko';
}) {
  const usSymbols = useMarketDataStore((state) => state.usSymbols);
  const loadStockSymbols = useMarketDataStore(
    (state) => state.loadStockSymbols,
  );
  const [view, setView] = useState<EarningsView>('daily');
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [query, setQuery] = useState('');
  const [selectedEarningsSymbol, setSelectedEarningsSymbol] = useState('');
  const [items, setItems] = useState<UsEarningsCalendarItem[]>([]);
  const [bounds, setBounds] = useState<UsEarningsCalendarBounds>({
    minDate: null,
    maxDate: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const range = useMemo(
    () => getEarningsRange(view, anchorDate),
    [view, anchorDate],
  );
  const effectiveQuery = query.trim();
  const highlightedSymbol = selectedEarningsSymbol.toUpperCase();
  const symbolSuggestions = useMemo(() => {
    if (!effectiveQuery || highlightedSymbol === effectiveQuery.toUpperCase()) {
      return [];
    }
    return usSymbols
      .map((item) => ({
        item,
        score: stockSearchScore(item, effectiveQuery),
      }))
      .filter(({ score }) => score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || a.item.symbol.localeCompare(b.item.symbol),
      )
      .slice(0, 8)
      .map(({ item }) => item);
  }, [effectiveQuery, highlightedSymbol, usSymbols]);

  useEffect(() => {
    if (accessToken) {
      void loadStockSymbols(accessToken);
    }
  }, [accessToken, loadStockSymbols]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let active = true;
    apiRequest<UsEarningsCalendarBounds>(
      '/markets/calendar/earnings/us/bounds',
      'GET',
      { accessToken },
    )
      .then((nextBounds) => {
        if (active) {
          setBounds(nextBounds);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      from: toDateKey(range.from),
      to: toDateKey(range.to),
    });
    if (effectiveQuery) {
      params.set('query', effectiveQuery);
    }

    apiRequest<UsEarningsCalendarItem[]>(
      `/markets/calendar/earnings/us?${params.toString()}`,
      'GET',
      { accessToken },
    )
      .then((nextItems) => {
        if (active) {
          setItems(nextItems);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : language === 'ko'
                ? '미국 실적 일정을 불러오지 못했습니다.'
                : 'Could not load US earnings calendar.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, effectiveQuery, language, range.from, range.to]);

  const searchLimited = !!effectiveQuery && items.length > 30;
  const visibleItems = searchLimited ? [] : items;
  const groupedItems = useMemo(
    () => groupEarningsByDate(visibleItems),
    [visibleItems],
  );
  const minDate = useMemo(() => {
    const retentionFloor = getPreviousMonthStart(new Date());
    const dataFloor = bounds.minDate
      ? parseDateKey(bounds.minDate)
      : startOfDay(new Date());
    return dataFloor > retentionFloor ? dataFloor : retentionFloor;
  }, [bounds.minDate]);
  const maxDate = useMemo(
    () =>
      bounds.maxDate ? parseDateKey(bounds.maxDate) : startOfDay(new Date()),
    [bounds.maxDate],
  );
  const canMovePrevious = canMoveEarningsRange(
    view,
    anchorDate,
    -1,
    minDate,
    maxDate,
  );
  const canMoveNext = canMoveEarningsRange(
    view,
    anchorDate,
    1,
    minDate,
    maxDate,
  );

  function moveRange(direction: -1 | 1) {
    if (direction < 0 && !canMovePrevious) {
      return;
    }
    if (direction > 0 && !canMoveNext) {
      return;
    }
    setAnchorDate((current) => shiftEarningsAnchor(view, current, direction));
  }

  async function selectEarningsSymbol(symbol: StockSymbol) {
    if (!accessToken) {
      return;
    }

    const ticker = symbol.symbol.toUpperCase();
    setQuery(ticker);
    setSelectedEarningsSymbol(ticker);

    const params = new URLSearchParams({
      from: toDateKey(minDate),
      to: toDateKey(maxDate),
      query: ticker,
    });
    const path = '/markets/calendar/earnings/us?' + params.toString();
    const results = await apiRequest<UsEarningsCalendarItem[]>(path, 'GET', {
      accessToken,
    }).catch(() => []);
    const today = startOfDay(new Date());
    const target =
      results.find(
        (item) =>
          item.symbol.toUpperCase() === ticker &&
          parseDateKey(item.reportDate) >= today,
      ) ??
      results.find((item) => item.symbol.toUpperCase() === ticker) ??
      results[0];
    if (target?.reportDate) {
      setAnchorDate(parseDateKey(target.reportDate));
    }
  }

  return (
    <div className="pt-4">
      {error ? <Notice message="" error={error} /> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="hidden">
            {language === 'ko'
              ? 'Alpha Vantage 실적 캘린더를 batch로 저장해 DB 기준으로 조회합니다.'
              : 'Stored from Alpha Vantage earnings calendar batches and served from the database.'}
          </p>
          <p className="text-xs font-semibold text-muted">
            {formatRangeLabel(range.from, range.to, language)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SegmentedControl<EarningsView>
            aria-label={language === 'ko' ? '실적 기간' : 'Earnings range'}
            options={[
              { value: 'daily', label: language === 'ko' ? '데일리' : 'Daily' },
              { value: 'weekly', label: language === 'ko' ? '주간' : 'Weekly' },
              {
                value: 'monthly',
                label: language === 'ko' ? '월간' : 'Monthly',
              },
            ]}
            value={view}
            onChange={(nextView) => {
              setView(nextView);
              setAnchorDate(startOfDay(new Date()));
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => moveRange(-1)}
              disabled={!canMovePrevious}
              className="grid size-10 cursor-pointer place-items-center rounded-md border border-border bg-surface text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
              aria-label={language === 'ko' ? '이전 기간' : 'Previous period'}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => moveRange(1)}
              disabled={!canMoveNext}
              className="grid size-10 cursor-pointer place-items-center rounded-md border border-border bg-surface text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
              aria-label={language === 'ko' ? '다음 기간' : 'Next period'}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {
        <div className="mt-4 flex flex-col gap-2 sm:max-w-md">
          <label
            className="text-xs font-semibold text-muted"
            htmlFor="earnings-search"
          >
            {language === 'ko'
              ? '티커 또는 회사명 검색'
              : 'Search ticker or company'}
          </label>
          <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 focus-within:border-primary">
            <Search size={17} className="text-muted" />
            <input
              id="earnings-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedEarningsSymbol('');
              }}
              placeholder={
                language === 'ko' ? '예: TSLA, Tesla' : 'e.g. TSLA, Tesla'
              }
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted"
            />
          </div>
          {symbolSuggestions.length ? (
            <div className="overflow-hidden rounded-md border border-border bg-surface shadow-lg">
              {symbolSuggestions.map((symbol) => (
                <button
                  key={symbol.symbol}
                  type="button"
                  onClick={() => selectEarningsSymbol(symbol)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
                >
                  <span className="shrink-0 font-semibold text-foreground">
                    {symbol.symbol}
                  </span>
                  <span className="min-w-0 truncate text-xs font-semibold text-muted">
                    {symbol.description}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {effectiveQuery ? (
            <p className="text-xs font-semibold text-muted">
              {language === 'ko'
                ? `검색 결과 ${items.length}건`
                : `${items.length} result${items.length === 1 ? '' : 's'}`}
            </p>
          ) : null}
        </div>
      }

      {searchLimited ? (
        <p className="mt-4 rounded-md border border-border bg-surface-muted px-4 py-3 text-sm font-semibold text-muted">
          {language === 'ko'
            ? '검색 결과가 너무 많습니다. 티커나 회사명을 더 입력해 주세요.'
            : 'Too many results. Type more of the ticker or company name.'}
        </p>
      ) : null}

      {loading ? (
        <IpoCalendarSkeleton />
      ) : view === 'monthly' ? (
        <MonthlyEarningsCalendar
          anchorDate={anchorDate}
          groupedItems={groupedItems}
          language={language}
          searching={!!effectiveQuery}
          highlightedSymbol={highlightedSymbol}
        />
      ) : (
        <EarningsList
          dates={dateKeysBetween(range.from, range.to)}
          groupedItems={groupedItems}
          language={language}
          highlightedSymbol={highlightedSymbol}
        />
      )}
    </div>
  );
}

function EarningsList({
  dates,
  groupedItems,
  language,
  highlightedSymbol,
}: {
  dates: string[];
  groupedItems: Map<string, UsEarningsCalendarItem[]>;
  language: 'en' | 'ko';
  highlightedSymbol: string;
}) {
  return (
    <div className="mt-4 grid gap-3">
      {dates.map((date) => {
        const items = groupedItems.get(date) ?? [];
        return (
          <section
            key={date}
            className="rounded-md border border-border bg-surface-muted p-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                {formatDate(date, language)}
              </h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {items.length}
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {items.length ? (
                items.map((item) => (
                  <EarningsCard
                    key={item.id}
                    item={item}
                    highlighted={
                      item.symbol.toUpperCase() === highlightedSymbol
                    }
                  />
                ))
              ) : (
                <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
                  {language === 'ko' ? '실적 발표 일정 없음' : 'No earnings'}
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MonthlyEarningsCalendar({
  anchorDate,
  groupedItems,
  language,
  searching,
  highlightedSymbol,
}: {
  anchorDate: Date;
  groupedItems: Map<string, UsEarningsCalendarItem[]>;
  language: 'en' | 'ko';
  searching: boolean;
  highlightedSymbol: string;
}) {
  const days = buildMonthDays(anchorDate, groupedItems, language);
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((day) => {
        const hidden = searching && day.events.length === 0;
        return (
          <div
            key={day.date}
            className={`min-h-32 rounded-md border p-3 ${
              day.inMonth
                ? 'border-border bg-surface-muted'
                : 'border-border/60 bg-surface text-muted'
            } ${hidden ? 'opacity-35' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-foreground">{day.day}</p>
                <p className="text-xs font-semibold text-muted">
                  {day.weekday}
                </p>
              </div>
              {day.events.length ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {day.events.length}
                </span>
              ) : null}
            </div>
            <div className="mt-3 grid gap-2">
              {day.events.slice(0, searching ? 30 : 3).map((item) => (
                <EarningsCompactCard
                  key={item.id}
                  item={item}
                  highlighted={
                    searching && item.symbol.toUpperCase() === highlightedSymbol
                  }
                />
              ))}
              {!searching && day.events.length > 3 ? (
                <p className="text-xs font-semibold text-muted">
                  +{day.events.length - 3}
                </p>
              ) : null}
              {searching && day.inMonth && !day.events.length ? (
                <p className="rounded-md border border-dashed border-border px-2 py-4 text-center text-xs text-muted">
                  {language === 'ko' ? '검색 결과 없음' : 'No result'}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EarningsCard({
  item,
  highlighted,
}: {
  item: UsEarningsCalendarItem;
  highlighted: boolean;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() =>
        router.push(`/?symbol=${encodeURIComponent(item.symbol)}&market=US`)
      }
      className={`min-w-0 cursor-pointer rounded-md border p-3 text-left transition-colors hover:border-primary hover:text-primary ${
        highlighted
          ? 'border-primary bg-primary/10'
          : 'border-border bg-surface'
      }`}
    >
      <p className="text-base font-bold text-foreground">{item.symbol}</p>
      <p className="mt-1 truncate text-sm font-semibold text-muted">
        {item.companyName}
      </p>
      <p className="mt-2 text-xs font-semibold text-primary">
        {formatEarningsMeta(item)}
      </p>
    </button>
  );
}

function EarningsCompactCard({
  item,
  highlighted,
}: {
  item: UsEarningsCalendarItem;
  highlighted: boolean;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() =>
        router.push(`/?symbol=${encodeURIComponent(item.symbol)}&market=US`)
      }
      className={`min-w-0 cursor-pointer rounded-md border px-2 py-2 text-left transition-colors hover:border-primary hover:text-primary ${
        highlighted
          ? 'border-primary bg-primary/10'
          : 'border-border bg-surface'
      }`}
    >
      <p className="truncate text-sm font-bold text-foreground">
        {item.symbol}
      </p>
      <p className="truncate text-[11px] font-semibold text-muted">
        {item.companyName}
      </p>
      <p className="mt-1 truncate text-[11px] font-semibold text-primary">
        {formatEarningsMeta(item)}
      </p>
    </button>
  );
}

function IpoCompactCard({
  event,
  language,
}: {
  event: IpoCalendarEvent;
  language: 'en' | 'ko';
}) {
  const item = event.item;
  const eventLabel =
    event.type === 'listing'
      ? language === 'ko'
        ? '상장'
        : 'Listing'
      : language === 'ko'
        ? '공모'
        : 'Subscription';
  const eventLabelClass =
    event.type === 'listing'
      ? 'text-primary'
      : 'text-pink-400 dark:text-pink-300';
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface px-2 py-2">
      <p className="break-all text-sm font-semibold leading-5 text-foreground [overflow-wrap:anywhere]">
        {item.corpName}{' '}
        <span className={`text-xs font-semibold ${eventLabelClass}`}>
          ({eventLabel})
        </span>
      </p>
      <p className="mt-1 break-words text-[11px] font-medium leading-4 text-muted">
        {item.underwriter ??
          (language === 'ko' ? '주관사 미확정' : 'Underwriter TBD')}
      </p>
      <p className="mt-1 break-words text-[11px] font-semibold leading-4 text-primary">
        {getOfferPriceValue(item) ??
          (language === 'ko' ? '공모가 미확정' : 'Price TBD')}
      </p>
    </div>
  );
}

function IpoListCard({
  item,
  language,
}: {
  item: IpoCalendarItem;
  language: 'en' | 'ko';
}) {
  return (
    <article className="rounded-md border border-border bg-surface-muted p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-foreground">
            {item.corpName}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            {item.stockCode ? `${item.stockCode} · ` : ''}
            {item.reportName}
          </p>
        </div>
        <a
          href={item.dartUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          DART
          <ExternalLink size={15} />
        </a>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <InfoCell
          label={language === 'ko' ? '청약일' : 'Subscription'}
          value={formatSubscription(item, language)}
        />
        <InfoCell
          label={language === 'ko' ? '상장일' : 'Listing date'}
          value={formatListingDate(item, language)}
        />
        <InfoCell
          label={getOfferPriceLabel(item, language)}
          value={getOfferPriceValue(item) ?? '-'}
        />
        <InfoCell
          label={language === 'ko' ? '주관사' : 'Underwriter'}
          value={item.underwriter ?? '-'}
        />
        <InfoCell
          label={language === 'ko' ? '공시 접수일' : 'Filed'}
          value={item.receiptDate}
        />
      </dl>
    </article>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface px-3 py-2">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold leading-5 text-foreground">
        {value}
      </dd>
    </div>
  );
}

function IpoCalendarSkeleton() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 14 }).map((_, index) => (
        <Skeleton key={index} className="h-32 rounded-md" />
      ))}
    </div>
  );
}

function buildRollingCalendar(
  items: IpoCalendarItem[],
  language: 'en' | 'ko',
): CalendarDay[] {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat(
    language === 'ko' ? 'ko-KR' : 'en-US',
    {
      month: 'short',
      day: 'numeric',
    },
  );
  const weekdayFormatter = new Intl.DateTimeFormat(
    language === 'ko' ? 'ko-KR' : 'en-US',
    { weekday: 'short' },
  );

  return Array.from({ length: 32 }).reduce<CalendarDay[]>((days, _, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() + index);
    if (isWeekend(date)) {
      return days;
    }
    const key = toDateKey(date);
    days.push({
      date: key,
      label: formatter.format(date),
      weekday: weekdayFormatter.format(date),
      events: buildCalendarEvents(items, key),
    });
    return days;
  }, []);
}

function buildMonthDays(
  anchorDate: Date,
  groupedItems: Map<string, UsEarningsCalendarItem[]>,
  language: 'en' | 'ko',
): EarningsCalendarDay[] {
  const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const weekdayFormatter = new Intl.DateTimeFormat(
    language === 'ko' ? 'ko-KR' : 'en-US',
    { weekday: 'short' },
  );

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = toDateKey(date);
    return {
      date: key,
      day: date.getDate(),
      weekday: weekdayFormatter.format(date),
      inMonth: date.getMonth() === anchorDate.getMonth(),
      events: groupedItems.get(key) ?? [],
    };
  });
}

function getEarningsRange(view: EarningsView, anchorDate: Date) {
  if (view === 'daily') {
    return { from: anchorDate, to: anchorDate };
  }
  if (view === 'weekly') {
    const from = new Date(anchorDate);
    from.setDate(anchorDate.getDate() - anchorDate.getDay());
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    return { from, to };
  }
  const from = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const to = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  return { from, to };
}

function shiftEarningsAnchor(
  view: EarningsView,
  current: Date,
  direction: -1 | 1,
): Date {
  const next = new Date(current);
  if (view === 'daily') {
    next.setDate(current.getDate() + direction);
  } else if (view === 'weekly') {
    next.setDate(current.getDate() + direction * 7);
  } else {
    next.setMonth(current.getMonth() + direction);
  }
  return startOfDay(next);
}

function canMoveEarningsRange(
  view: EarningsView,
  anchorDate: Date,
  direction: -1 | 1,
  minDate: Date,
  maxDate: Date,
): boolean {
  const nextAnchor = shiftEarningsAnchor(view, anchorDate, direction);
  const nextRange = getEarningsRange(view, nextAnchor);
  return (
    startOfDay(nextRange.to) >= startOfDay(minDate) &&
    startOfDay(nextRange.from) <= startOfDay(maxDate)
  );
}

function groupEarningsByDate(items: UsEarningsCalendarItem[]) {
  const grouped = new Map<string, UsEarningsCalendarItem[]>();
  items.forEach((item) => {
    const current = grouped.get(item.reportDate) ?? [];
    current.push(item);
    grouped.set(item.reportDate, current);
  });
  return grouped;
}

function dateKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const current = new Date(from);
  while (current <= to) {
    if (!isWeekend(current)) {
      keys.push(toDateKey(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return keys;
}

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey.slice(0, 10)}T00:00:00`);
}

function getPreviousMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isDateInSubscriptionRange(
  item: IpoCalendarItem,
  date: string,
): boolean {
  if (!item.subscriptionStartDate) {
    return false;
  }
  const endDate = item.subscriptionEndDate ?? item.subscriptionStartDate;
  return item.subscriptionStartDate <= date && date <= endDate;
}

function buildCalendarEvents(
  items: IpoCalendarItem[],
  date: string,
): IpoCalendarEvent[] {
  return items.flatMap((item) => {
    const events: IpoCalendarEvent[] = [];
    if (isDateInSubscriptionRange(item, date)) {
      events.push({ item, type: 'subscription' });
    }
    if (item.listingDate === date) {
      events.push({ item, type: 'listing' });
    }
    return events;
  });
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function formatDate(date: string, language: 'en' | 'ko'): string {
  return new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${date}T00:00:00`));
}

function formatRangeLabel(from: Date, to: Date, language: 'en' | 'ko'): string {
  const formatter = new Intl.DateTimeFormat(
    language === 'ko' ? 'ko-KR' : 'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  );
  if (toDateKey(from) === toDateKey(to)) {
    return formatter.format(from);
  }
  return `${formatter.format(from)} - ${formatter.format(to)}`;
}

function formatEarningsMeta(item: UsEarningsCalendarItem): string {
  const estimate =
    item.estimate !== null && item.currency
      ? `EPS ${item.estimate.toFixed(2)} ${item.currency}`
      : 'EPS -';
  const time = item.timeOfTheDay || 'Time TBD';
  return `${estimate} · ${time}`;
}

function formatSubscription(
  item: IpoCalendarItem,
  language: 'en' | 'ko',
): string {
  if (item.subscriptionDateText) {
    return item.subscriptionDateText;
  }
  if (item.subscriptionStartDate) {
    return item.subscriptionStartDate;
  }
  return language === 'ko' ? '문서 확인 필요' : 'Check DART filing';
}

function formatListingDate(
  item: IpoCalendarItem,
  language: 'en' | 'ko',
): string {
  if (item.listingDateText) {
    return item.listingDateText;
  }
  if (item.listingDate) {
    return item.listingDate;
  }
  return language === 'ko' ? '상장일 미정' : 'Listing date TBD';
}

function getOfferPriceValue(item: IpoCalendarItem): string | null {
  return item.confirmedOfferPrice ?? item.expectedOfferPrice;
}

function getOfferPriceLabel(
  item: IpoCalendarItem,
  language: 'en' | 'ko',
): string {
  if (item.confirmedOfferPrice) {
    return language === 'ko' ? '확정공모가' : 'Confirmed price';
  }
  return language === 'ko' ? '희망공모가' : 'Expected price';
}
