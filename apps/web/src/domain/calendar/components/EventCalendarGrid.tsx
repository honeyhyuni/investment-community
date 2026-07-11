// Deprecated: replaced by `Calendar` (see ./Calendar.tsx). No longer used anywhere
// in the app — safe to delete this file. Kept temporarily because this session's
// shell sandbox couldn't run `rm` (no disk space); please delete manually.
import type { ReactNode } from 'react';

export type CalendarGridDay<TEvent> = {
  date: string;
  label: string;
  weekday: string;
  events: TEvent[];
};

type EventCalendarGridProps<
  TEvent,
  TDay extends CalendarGridDay<TEvent> = CalendarGridDay<TEvent>,
> = {
  days: TDay[];
  emptyLabel?: string | ((day: TDay) => string | null);
  getEventKey: (event: TEvent) => string;
  renderEvent: (event: TEvent) => ReactNode;
  countClassName?: string;
  gridClassName?: string;
  isDayDimmed?: (day: TDay) => boolean;
  maxVisibleEvents?: number | ((day: TDay) => number);
  moreLabel?: (hiddenCount: number) => string;
};

export function EventCalendarGrid<
  TEvent,
  TDay extends CalendarGridDay<TEvent> = CalendarGridDay<TEvent>,
>({
  days,
  emptyLabel,
  getEventKey,
  renderEvent,
  countClassName = 'bg-primary/10 text-primary',
  gridClassName = 'mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7',
  isDayDimmed,
  maxVisibleEvents,
  moreLabel = (hiddenCount) => `+${hiddenCount}`,
}: EventCalendarGridProps<TEvent, TDay>) {
  return (
    <div className={gridClassName}>
      {days.map((day) => {
        const dimmed = isDayDimmed?.(day) ?? false;
        const visibleLimit =
          typeof maxVisibleEvents === 'function'
            ? maxVisibleEvents(day)
            : maxVisibleEvents;
        const visibleEvents =
          visibleLimit === undefined
            ? day.events
            : day.events.slice(0, visibleLimit);
        const hiddenCount = day.events.length - visibleEvents.length;
        const resolvedEmptyLabel =
          typeof emptyLabel === 'function' ? emptyLabel(day) : emptyLabel;

        return (
          <div
            key={day.date}
            className={`min-h-32 min-w-0 rounded-md border p-3 ${
              dimmed
                ? 'border-border/60 bg-surface text-muted'
                : 'border-border bg-surface-muted'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">
                  {day.label}
                </p>
                <p className="text-xs font-semibold text-muted">
                  {day.weekday}
                </p>
              </div>
              {day.events.length ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${countClassName}`}
                >
                  {day.events.length}
                </span>
              ) : null}
            </div>

            <div className="mt-3 grid gap-2">
              {visibleEvents.map((event) => (
                <div key={getEventKey(event)}>{renderEvent(event)}</div>
              ))}
              {hiddenCount > 0 ? (
                <p className="text-xs font-semibold text-muted">
                  {moreLabel(hiddenCount)}
                </p>
              ) : null}
              {resolvedEmptyLabel ? (
                <p className="rounded-md border border-dashed border-border px-2 py-4 text-center text-xs text-muted">
                  {resolvedEmptyLabel}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
