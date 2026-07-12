'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, CircleQuestionMark, ExternalLink, List } from 'lucide-react';

import { apiRequest } from '@/common/lib/api';
import { Notice } from '@/common/components/Notice';
import { Calendar, CalendarDay } from '@/domain/calendar/components/Calendar';
import { CalendarDots } from '@/domain/calendar/components/CalendarDots';
import { CalendarRangeNav } from '@/domain/calendar/components/CalendarRangeNav';
import {
  CalendarListSkeleton,
  CalendarSkeleton,
} from '@/domain/calendar/components/CalendarSkeleton';
import { ViewToggle } from '@/domain/calendar/components/ViewToggle';
import {
  addDays,
  addMonths,
  buildMonthGrid,
  dateKeysBetween,
  formatDayLabel,
  formatMonthLabel,
  isAfterMonth,
  isBeforeMonth,
  isWeekend,
  startOfDay,
  startOfMonth,
  weekdayLabels,
} from '@/domain/calendar/utils/date';
import { IpoCalendarItem } from '@/domain/ipo/types';
import {
  IpoCalendarEvent,
  buildIpoCalendarEvents,
  getUnderwriterNames,
} from '@/domain/ipo/utils/ipoCalendar';

import { IpoCompactCard } from '@/domain/ipo/components/cards/IpoCompactCard';
import { IpoDetailBody, IpoDetailModal } from '@/domain/ipo/components/cards/IpoDetailModal';
import { IpoEventList } from '@/domain/ipo/components/IpoEventList';
import { UnderwriterFilter } from '@/domain/ipo/components/UnderwriterFilter';

/** 공모주 데이터가 제공되는 범위 (오늘 포함 32일). */
const IPO_WINDOW_DAYS = 32;

type IpoCalendarGridDay = CalendarDay<IpoCalendarEvent>;
type IpoViewMode = 'calendar' | 'list';

export function IpoCalendarSection({
  accessToken,
  language,
}: {
  accessToken: string | null;
  language: 'en' | 'ko';
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlViewMode: IpoViewMode =
    searchParams.get('view') === 'calendar' ? 'calendar' : 'list';
  const [items, setItems] = useState<IpoCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [anchorMonth, setAnchorMonth] = useState(() => startOfMonth(new Date()));
  const [selectedItem, setSelectedItem] = useState<IpoCalendarItem | null>(null);
  const [viewMode, setViewMode] = useState<IpoViewMode>(urlViewMode);
  const [selectedUnderwriters, setSelectedUnderwriters] = useState<string[]>([]);

  useEffect(() => {
    setViewMode(urlViewMode);
  }, [urlViewMode]);

  function changeViewMode(nextMode: IpoViewMode) {
    setViewMode(nextMode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', nextMode);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

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

  const windowStart = useMemo(() => startOfDay(new Date()), []);
  const windowEnd = useMemo(
    () => addDays(windowStart, IPO_WINDOW_DAYS - 1),
    [windowStart],
  );
  const minMonth = useMemo(() => startOfMonth(windowStart), [windowStart]);
  const maxMonth = useMemo(() => startOfMonth(windowEnd), [windowEnd]);

  const canPrev = isAfterMonth(anchorMonth, minMonth);
  const canNext = isBeforeMonth(anchorMonth, maxMonth);

  const underwriterOptions = useMemo(() => {
    const counts = new Map<string, number>();
    items
      .filter((item) => item.subscriptionStartDate) // 상장만 있는 건 빼고 공모 건만 집계
      .forEach((item) => {
        getUnderwriterNames(item).forEach((name) => {
          counts.set(name, (counts.get(name) ?? 0) + 1);
        });
      });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!selectedUnderwriters.length) {
      return items;
    }
    return items.filter((item) =>
      getUnderwriterNames(item).some((name) =>
        selectedUnderwriters.includes(name),
      ),
    );
  }, [items, selectedUnderwriters]);

  const days = useMemo<IpoCalendarGridDay[]>(
    () =>
      buildMonthGrid(anchorMonth).map((cell) => {
        const disabled =
          cell.date < windowStart || cell.date > windowEnd || isWeekend(cell.date);
        return {
          ...cell,
          disabled,
          events: disabled ? [] : buildIpoCalendarEvents(filteredItems, cell.dateKey),
        };
      }),
    [anchorMonth, filteredItems, windowStart, windowEnd],
  );

  // 목록형: 32일 윈도우 전체에서 실제로 일정이 있는 날짜만 골라낸다.
  const groupedEvents = useMemo(() => {
    const grouped = new Map<string, IpoCalendarEvent[]>();
    dateKeysBetween(windowStart, windowEnd, { skipWeekends: true }).forEach(
      (dateKey) => {
        const events = buildIpoCalendarEvents(filteredItems, dateKey);
        if (events.length) {
          grouped.set(dateKey, events);
        }
      },
    );
    return grouped;
  }, [filteredItems, windowStart, windowEnd]);
  const eventDates = useMemo(
    () => Array.from(groupedEvents.keys()),
    [groupedEvents],
  );

  return (
    <div>
      {error ? <Notice error={error} /> : null}

      <div className="mt-4 flex items-start gap-1.5 rounded-md bg-surface-subtle px-3 py-2 text-xs font-bold text-muted">
        <CircleQuestionMark size={14} className="mt-0.5 shrink-0" />
        <span>
          {language === 'ko'
            ? `오늘부터 ${IPO_WINDOW_DAYS}일간의 공모주 청약·상장 일정만 제공합니다. DART 공시 기준으로 매일 새벽 3시에 갱신됩니다.`
            : `Only shows IPO subscription/listing schedules for the next ${IPO_WINDOW_DAYS} days from today. Updated daily at 3 AM from DART disclosures.`}
        </span>
      </div>

      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <ViewToggle<IpoViewMode>
          aria-label={language === 'ko' ? '보기 방식' : 'View mode'}
          options={[
            {
              value: 'list',
              label: language === 'ko' ? '목록' : 'List',
              icon: List,
            },
            {
              value: 'calendar',
              label: language === 'ko' ? '달력' : 'Calendar',
              icon: CalendarDays,
            },
          ]}
          value={viewMode}
          onChange={changeViewMode}
        />
        <UnderwriterFilter
          options={underwriterOptions}
          selected={selectedUnderwriters}
          onChange={setSelectedUnderwriters}
          language={language}
        />
      </div>

      {loading ? (
        viewMode === 'calendar' ? (
          <CalendarSkeleton />
        ) : (
          <CalendarListSkeleton cardClassName="h-24" />
        )
      ) : viewMode === 'calendar' ? (
        <Calendar<IpoCalendarEvent, IpoCalendarGridDay>
          days={days}
          weekdayLabels={weekdayLabels(language)}
          nav={
            <CalendarRangeNav
              label={formatMonthLabel(anchorMonth, language)}
              onPrev={() => canPrev && setAnchorMonth((month) => startOfMonth(addMonths(month, -1)))}
              onNext={() => canNext && setAnchorMonth((month) => startOfMonth(addMonths(month, 1)))}
              canPrev={canPrev}
              canNext={canNext}
              prevAriaLabel={language === 'ko' ? '이전 달' : 'Previous month'}
              nextAriaLabel={language === 'ko' ? '다음 달' : 'Next month'}
            />
          }
          renderDayTitle={(day) => formatDayLabel(day.dateKey, language)}
          renderCount={(count) => (
            <CalendarDots
              count={count}
              label={language === 'ko' ? `${count}개` : `${count}`}
            />
          )}
          getEventKey={(event) => `${event.item.id}-${event.type}`}
          renderEvent={(event) => (
            <IpoCompactCard
              event={event}
              language={language}
              onClick={() => setSelectedItem(event.item)}
            />
          )}
          renderEventInList={(event, _day, onSelect) => (
            <IpoCompactCard event={event} language={language} onClick={onSelect} />
          )}
          renderEventDetail={(event) => (
            <IpoDetailBody item={event.item} language={language} />
          )}
          renderEventDetailFooter={(event) => (
            <a
              href={event.item.dartUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              {language === 'ko' ? 'DART 공시 보기' : 'View DART filing'}
              <ExternalLink size={15} />
            </a>
          )}
        />
      ) : (
        <IpoEventList
          dates={eventDates}
          groupedEvents={groupedEvents}
          language={language}
          onSelectItem={(event) => setSelectedItem(event.item)}
        />
      )}

      <IpoDetailModal
        item={selectedItem}
        language={language}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
