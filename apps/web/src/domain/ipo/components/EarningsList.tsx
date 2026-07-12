import { EmptyState } from '@/common/components/EmptyState';
import { UsEarningsCalendarItem } from '@/domain/ipo/types';
import { formatDayLabel } from '@/domain/calendar/utils/date';

import { EarningsCard } from '@/domain/ipo/components/cards/EarningsCard';

/**
 * 데일리/주간 뷰: 날짜별 섹션 + 카드 그리드.
 * 조회 범위 전체에 일정이 하나도 없으면(예: 주말인 데일리 탭) 날짜별 빈 섹션을 여러 개
 * 늘어놓는 대신 큰 Empty 상태 하나로 보여준다. 일부만 비어 있으면(주간 뷰에서 특정 요일만
 * 일정이 없는 경우) 그 날짜 섹션 안에서만 작은 안내 문구로 표시한다.
 */
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
  const totalItems = dates.reduce(
    (sum, date) => sum + (groupedItems.get(date)?.length ?? 0),
    0,
  );

  if (!dates.length || totalItems === 0) {
    return (
      <EmptyState
        className="mt-4"
        title={
          language === 'ko'
            ? '실적 발표 일정이 없습니다.'
            : 'No earnings scheduled.'
        }
        body={
          language === 'ko'
            ? '다른 날짜나 기간을 선택해 보세요.'
            : 'Try a different date or period.'
        }
      />
    );
  }

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
