'use client';

import { useState, type ReactNode } from 'react';

import { Modal } from '@/common/components/Modal';
import { cn } from '@/common/utils/cn';
import { MonthGridCell, toDateKey } from '@/domain/calendar/utils/date';

export type CalendarDay<TEvent> = MonthGridCell & {
  /** 데이터가 없거나 범위 밖이라 상호작용을 막아야 하는 날짜. 이벤트가 렌더링되지 않는다. */
  disabled?: boolean;
  events: TEvent[];
};

type CalendarProps<
  TEvent,
  TDay extends CalendarDay<TEvent> = CalendarDay<TEvent>,
> = {
  days: TDay[];
  weekdayLabels: string[];
  /** 달력 위에 표시할 안내 배너 (Notice info 등). */
  notice?: ReactNode;
  /** 달력 위, notice 아래에 표시할 네비게이션/필터 영역. */
  nav?: ReactNode;
  getEventKey: (event: TEvent, day: TDay) => string;
  /** 카드 하나를 그린다. 날짜 칸을 눌렀을 때 뜨는 모달 안에서 쓰인다. */
  renderEvent: (event: TEvent, day: TDay) => ReactNode;
  /** 날짜 칸을 눌렀을 때 뜨는 모달의 제목. 기본은 날짜 키(YYYY-MM-DD). */
  renderDayTitle?: (day: TDay) => ReactNode;
  /** 칸 안에 보여줄 건수 라벨. 기본은 숫자만 그대로. */
  countLabel?: (count: number) => string;
  countClassName?: string;
  gridClassName?: string;
  className?: string;
};

const CELL_BASE_CLASS =
  'flex h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md border p-1 sm:h-20 sm:p-2';

/**
 * 공모주 달력 / 실적 발표 달력이 공유하는 요일 정렬 월간 그리드.
 * 칸은 폭이 좁아져도 세로로 길어지지 않도록 고정 높이를 쓰고, 날짜와 건수만 보여준다.
 * 일정이 있는 칸을 누르면 그날의 이벤트 목록을 모달로 보여준다. 카드 디자인은 renderEvent가 결정한다.
 */
export function Calendar<
  TEvent,
  TDay extends CalendarDay<TEvent> = CalendarDay<TEvent>,
>({
  days,
  weekdayLabels,
  notice,
  nav,
  getEventKey,
  renderEvent,
  renderDayTitle,
  countLabel = (count) => `${count}`,
  countClassName = 'bg-primary/10 text-primary',
  gridClassName,
  className,
}: CalendarProps<TEvent, TDay>) {
  const todayKey = toDateKey(new Date());
  const [selectedDay, setSelectedDay] = useState<TDay | null>(null);

  return (
    <div className={cn('min-w-0', className)}>
      {notice}
      {nav ? <div className="mt-4">{nav}</div> : null}

      <table className="mt-4 w-full table-fixed border-separate border-spacing-0">
        <thead>
          <tr>
            {weekdayLabels.map((label, index) => (
              <th
                key={`${label}-${index}`}
                scope="col"
                className="border-b border-border bg-surface-subtle px-1 py-2 text-center text-xs font-semibold text-muted first:rounded-tl-md last:rounded-tr-md sm:text-sm"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
      </table>

      <div className={cn('mt-2 grid grid-cols-7 gap-1 sm:gap-2', gridClassName)}>
        {days.map((day) => {
          const isToday = day.dateKey === todayKey;
          const hasEvents = !day.disabled && day.events.length > 0;

          const cellClassName = cn(
            CELL_BASE_CLASS,
            day.disabled
              ? 'border-border/50 bg-surface/60'
              : day.inCurrentMonth
                ? 'border-border bg-surface-muted'
                : 'border-border/60 bg-surface',
            isToday && 'border-primary ring-1 ring-inset ring-primary',
            hasEvents &&
              'cursor-pointer transition-colors hover:border-primary',
          );

          const dayNumber = isToday ? (
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white sm:size-6 sm:text-xs">
              {day.date.getDate()}
            </span>
          ) : (
            <span
              className={cn(
                'text-xs font-bold sm:text-sm',
                day.disabled
                  ? 'text-muted/60'
                  : day.inCurrentMonth
                    ? 'text-foreground'
                    : 'text-muted',
              )}
            >
              {day.date.getDate()}
            </span>
          );

          const countBadge = hasEvents ? (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:text-xs',
                countClassName,
              )}
            >
              {countLabel(day.events.length)}
            </span>
          ) : null;

          return hasEvents ? (
            <button
              key={day.dateKey}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={cellClassName}
            >
              {dayNumber}
              {countBadge}
            </button>
          ) : (
            <div key={day.dateKey} className={cellClassName}>
              {dayNumber}
              {countBadge}
            </div>
          );
        })}
      </div>

      <Modal
        open={!!selectedDay}
        title={
          selectedDay
            ? renderDayTitle
              ? renderDayTitle(selectedDay)
              : selectedDay.dateKey
            : ''
        }
        onClose={() => setSelectedDay(null)}
      >
        {selectedDay ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedDay.events.map((event) => (
              <div key={getEventKey(event, selectedDay)} className="min-w-0">
                {renderEvent(event, selectedDay)}
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
