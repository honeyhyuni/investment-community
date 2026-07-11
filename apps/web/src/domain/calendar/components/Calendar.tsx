import type { ReactNode } from 'react';

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
  /** 카드 하나를 그린다. 공모주/실적 등 실제 카드 디자인은 전부 여기서만 갈린다. */
  renderEvent: (event: TEvent, day: TDay) => ReactNode;
  emptyLabel?: string | ((day: TDay) => string | null);
  countClassName?: string;
  gridClassName?: string;
  className?: string;
};

/**
 * 공모주 달력 / 실적 발표 달력이 공유하는 요일 정렬 월간 그리드.
 * 일자·요일 헤더, 카운트 뱃지 규칙은 이 컴포넌트가 전담해서 두 달력이 항상 같은 모양을
 * 갖도록 한다. 칸은 고정 높이라 이벤트가 많으면 칸 내부에서 세로 스크롤된다.
 * 카드 자체의 디자인만 renderEvent가 결정한다.
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
  emptyLabel,
  countClassName = 'bg-primary/10 text-primary',
  gridClassName,
  className,
}: CalendarProps<TEvent, TDay>) {
  const todayKey = toDateKey(new Date());

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
          const resolvedEmptyLabel = day.disabled
            ? null
            : typeof emptyLabel === 'function'
              ? emptyLabel(day)
              : day.events.length === 0
                ? (emptyLabel ?? null)
                : null;

          return (
            <div
              key={day.dateKey}
              className={cn(
                'flex h-44 min-w-0 flex-col rounded-md border p-1.5 sm:h-56 sm:p-3',
                day.disabled
                  ? 'border-border/50 bg-surface/60'
                  : day.inCurrentMonth
                    ? 'border-border bg-surface-muted'
                    : 'border-border/60 bg-surface',
                isToday && 'border-primary ring-1 ring-inset ring-primary',
              )}
            >
              <div className="flex shrink-0 items-center justify-between gap-1">
                {isToday ? (
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
                )}
                {!day.disabled && day.events.length ? (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:text-xs',
                      countClassName,
                    )}
                  >
                    {day.events.length}
                  </span>
                ) : null}
              </div>

              {day.disabled ? null : (
                <div className="mt-1.5 flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden sm:mt-2">
                  {day.events.map((event) => (
                    <div key={getEventKey(event, day)} className="min-w-0 shrink-0">
                      {renderEvent(event, day)}
                    </div>
                  ))}
                  {resolvedEmptyLabel ? (
                    <p className="rounded-md border border-dashed border-border px-1 py-2 text-center text-[10px] text-muted sm:text-xs">
                      {resolvedEmptyLabel}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
