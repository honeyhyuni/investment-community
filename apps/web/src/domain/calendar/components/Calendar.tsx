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
  /** 카드 하나를 그린다. PC에서는 칸 안에 직접, 좁은 화면에서는 날짜 클릭 시 모달 안에서 쓰인다. */
  renderEvent: (event: TEvent, day: TDay) => ReactNode;
  /** 좁은 화면에서 날짜 칸을 눌렀을 때 뜨는 모달의 제목. 기본은 날짜 키(YYYY-MM-DD). */
  renderDayTitle?: (day: TDay) => ReactNode;
  /** 칸 안에 보여줄 건수 라벨. 기본은 숫자만 그대로. renderCount가 있으면 무시된다. */
  countLabel?: (count: number) => string;
  countClassName?: string;
  /** 건수를 숫자 배지 대신 직접 그리고 싶을 때 (예: 점 인디케이터). 날짜 아래에 표시된다. */
  renderCount?: (count: number, day: TDay) => ReactNode;
  gridClassName?: string;
  className?: string;
};

/**
 * 공모주 달력 / 실적 발표 달력이 공유하는 요일 정렬 월간 그리드.
 * PC 폭(md 이상, Market Pulse가 한 줄로 바뀌는 지점과 동일)에서는 칸 안에 카드가 직접
 * 나열되고 넘치면 칸 내부에서 스크롤된다. 좁은 화면(md 미만)에서는 칸 비율이 깨지는 걸
 * 막기 위해 날짜와 건수만 보여주고, 칸을 누르면 그날 이벤트 목록을 모달로 보여준다.
 * 카드 디자인은 renderEvent가 결정한다.
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
  renderCount,
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
                className="border-b border-border bg-surface-subtle px-1 py-2 text-center text-xs font-semibold text-muted first:rounded-tl-md last:rounded-tr-md md:text-sm"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
      </table>

      <div className={cn('mt-2 grid grid-cols-7 gap-1 md:gap-2', gridClassName)}>
        {days.map((day) => {
          const isToday = day.dateKey === todayKey;
          const hasEvents = !day.disabled && day.events.length > 0;

          const dayNumber = isToday ? (
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white md:size-6 md:text-xs">
              {day.date.getDate()}
            </span>
          ) : (
            <span
              className={cn(
                'text-xs font-bold md:text-sm',
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
            renderCount ? (
              renderCount(day.events.length, day)
            ) : (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold md:text-xs',
                  countClassName,
                )}
              >
                {countLabel(day.events.length)}
              </span>
            )
          ) : null;

          return (
            <div
              key={day.dateKey}
              className={cn(
                'relative flex h-16 min-w-0 flex-col rounded-md border p-1.5 md:h-44 md:p-3 lg:h-56',
                day.disabled
                  ? 'border-border/50 bg-surface/60'
                  : day.inCurrentMonth
                    ? 'border-border bg-surface-muted'
                    : 'border-border/60 bg-surface',
                isToday && 'border-primary ring-1 ring-inset ring-primary',
              )}
            >
              {/* 좁은 화면 전용: 칸 전체를 덮는 투명 버튼. PC에서는(md~) 숨겨서 아래 카드들이
                  직접 클릭되게 한다. */}
              {hasEvents ? (
                <button
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  aria-label={
                    renderDayTitle ? undefined : `${day.dateKey} (${day.events.length})`
                  }
                  className="absolute inset-0 z-10 rounded-md md:hidden"
                >
                  {renderDayTitle ? (
                    <span className="sr-only">{renderDayTitle(day)}</span>
                  ) : null}
                </button>
              ) : null}

              {renderCount ? (
                <div className="flex shrink-0 flex-col items-start gap-1">
                  {dayNumber}
                  {countBadge ? (
                    <div className="flex w-full justify-center">{countBadge}</div>
                  ) : null}
                </div>
              ) : (
                <div className="flex shrink-0 items-center justify-between gap-1">
                  {dayNumber}
                  {countBadge}
                </div>
              )}

              {day.disabled ? null : (
                <div className="mt-1.5 hidden min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden md:mt-2 md:flex">
                  {day.events.map((event) => (
                    <div
                      key={getEventKey(event, day)}
                      className="min-w-0 shrink-0"
                    >
                      {renderEvent(event, day)}
                    </div>
                  ))}
                </div>
              )}
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
