import { UsEarningsCalendarItem } from '@/domain/ipo/types';
import { formatDayLabel } from '@/domain/calendar/utils/date';

import { EarningsCard } from '@/domain/ipo/components/cards/EarningsCard';

/** 데일리/주간 뷰: 날짜별 섹션 + 카드 그리드. */
export function EarningsList({
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
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold leading-none text-foreground">
                {formatDayLabel(date, language)}
              </h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold leading-none text-primary">
                {items.length}
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {items.length ? (
                items.map((item) => (
                  <EarningsCard
                    key={item.id}
                    item={item}
                    language={language}
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
