'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { apiRequest } from '@/common/lib/api';
import { Notice } from '@/common/components/Notice';
import { SegmentedControl } from '@/common/components/SegmentedControl';
import { useMarketDataStore } from '@/common/stores/market-data';
import { StockSymbol } from '@/common/types';
import { stockSearchScore } from '@/common/utils/stock-search';
import { Calendar, CalendarDay } from '@/domain/calendar/components/Calendar';
import { CalendarRangeNav } from '@/domain/calendar/components/CalendarRangeNav';
import {
  CalendarListSkeleton,
  CalendarSkeleton,
} from '@/domain/calendar/components/CalendarSkeleton';
import {
  buildMonthGrid,
  dateKeysBetween,
  formatDayLabel,
  formatMonthLabel,
  formatRangeLabel,
  getPreviousMonthStart,
  parseDateKey,
  startOfDay,
  toDateKey,
  weekdayLabels,
} from '@/domain/calendar/utils/date';
import {
  UsEarningsCalendarBounds,
  UsEarningsCalendarItem,
} from '@/domain/ipo/types';
import {
  EarningsView,
  canMoveEarningsRange,
  getEarningsRange,
  groupEarningsByDate,
  shiftEarningsAnchor,
} from '@/domain/ipo/utils/earningsCalendar';

import { EarningsList } from '@/domain/ipo/components/EarningsList';
import { EarningsCompactCard } from '@/domain/ipo/components/cards/EarningsCompactCard';

type EarningsGridDay = CalendarDay<UsEarningsCalendarItem>;

export function UsEarningsSection({
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
  const [myCalendarOnly, setMyCalendarOnly] = useState(false);
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
      `${myCalendarOnly ? '/markets/calendar/earnings/us/mine' : '/markets/calendar/earnings/us'}?${params.toString()}`,
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
  }, [accessToken, effectiveQuery, language, myCalendarOnly, range.from, range.to]);

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

  const monthDays: EarningsGridDay[] = useMemo(
    () =>
      buildMonthGrid(anchorDate).map((cell) => ({
        ...cell,
        events: groupedItems.get(cell.dateKey) ?? [],
      })),
    [anchorDate, groupedItems],
  );

  return (
    <div className="pt-4">
      {error ? <Notice error={error} /> : null}

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
      </div>

      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
        <input
          type="checkbox"
          checked={myCalendarOnly}
          onChange={(event) => {
            setMyCalendarOnly(event.target.checked);
            if (event.target.checked) {
              setQuery('');
              setSelectedEarningsSymbol('');
            }
          }}
          className="size-4 accent-primary"
        />
        {language === 'ko' ? '내 관심종목·포트폴리오만' : 'My favorites and portfolio only'}
      </label>

      <div className="mt-4 flex flex-col gap-2 sm:max-w-md">
        <label
          className="text-xs font-semibold text-muted"
          htmlFor="earnings-search"
        >
          {language === 'ko' ? '티커 또는 회사명 검색' : 'Search ticker or company'}
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

      {searchLimited ? (
        <p className="mt-4 rounded-md border border-border bg-surface-muted px-4 py-3 text-sm font-semibold text-muted">
          {language === 'ko'
            ? '검색 결과가 너무 많습니다. 티커나 회사명을 더 입력해 주세요.'
            : 'Too many results. Type more of the ticker or company name.'}
        </p>
      ) : null}

      {loading ? (
        view === 'monthly' ? (
          <CalendarSkeleton />
        ) : (
          <CalendarListSkeleton boxed cardClassName="h-16" />
        )
      ) : view === 'monthly' ? (
        <Calendar<UsEarningsCalendarItem, EarningsGridDay>
          days={monthDays}
          weekdayLabels={weekdayLabels(language)}
          nav={
            <CalendarRangeNav
              label={formatMonthLabel(anchorDate, language)}
              onPrev={() => moveRange(-1)}
              onNext={() => moveRange(1)}
              canPrev={canMovePrevious}
              canNext={canMoveNext}
              prevAriaLabel={language === 'ko' ? '이전 달' : 'Previous month'}
              nextAriaLabel={language === 'ko' ? '다음 달' : 'Next month'}
            />
          }
          renderDayTitle={(day) => formatDayLabel(day.dateKey, language)}
          countLabel={(count) => (language === 'ko' ? `${count}건` : `${count}`)}
          getEventKey={(item) => item.id}
          renderEvent={(item) => (
            <EarningsCompactCard
              item={item}
              highlighted={
                !!effectiveQuery &&
                item.symbol.toUpperCase() === highlightedSymbol
              }
            />
          )}
        />
      ) : (
        <>
          <CalendarRangeNav
            className="mt-4"
            label={formatRangeLabel(range.from, range.to, language)}
            onPrev={() => moveRange(-1)}
            onNext={() => moveRange(1)}
            canPrev={canMovePrevious}
            canNext={canMoveNext}
            prevAriaLabel={language === 'ko' ? '이전 기간' : 'Previous period'}
            nextAriaLabel={language === 'ko' ? '다음 기간' : 'Next period'}
          />
          <EarningsList
            dates={dateKeysBetween(range.from, range.to, { skipWeekends: true })}
            groupedItems={groupedItems}
            language={language}
            highlightedSymbol={highlightedSymbol}
          />
        </>
      )}
    </div>
  );
}
