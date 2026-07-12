import { formatDayLabel } from '@/domain/calendar/utils/date';
import { IpoCalendarEvent } from '@/domain/ipo/utils/ipoCalendar';

import { IpoCompactCard } from '@/domain/ipo/components/cards/IpoCompactCard';

/** 목록형 뷰: 일정이 실제로 존재하는 날짜만 골라 날짜별 섹션으로 보여준다. */
export function IpoEventList({
  dates,
  groupedEvents,
  language,
  onSelectItem,
}: {
  dates: string[];
  groupedEvents: Map<string, IpoCalendarEvent[]>;
  language: 'en' | 'ko';
  onSelectItem: (event: IpoCalendarEvent) => void;
}) {
  if (!dates.length) {
    return (
      <p className="mt-4 rounded-md border border-dashed border-border bg-surface-muted px-4 py-10 text-center text-sm text-muted">
        {language === 'ko'
          ? '표시할 공모주 일정이 없습니다.'
          : 'No IPO schedules to show.'}
      </p>
    );
  }

  return (
    <div className="mt-4">
      {dates.map((date, index) => {
        const events = groupedEvents.get(date) ?? [];
        return (
          <div
            key={date}
            className={index > 0 ? 'mt-6 border-t border-border pt-6' : ''}
          >
            <div className="flex items-baseline gap-2">
              <h3 className="text-lg font-bold text-foreground sm:text-xl">
                {formatDayLabel(date, language)}
              </h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {events.length}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <IpoCompactCard
                  key={`${event.item.id}-${event.type}`}
                  event={event}
                  language={language}
                  onClick={() => onSelectItem(event)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
