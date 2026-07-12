import { UsEarningsCalendarItem } from '@/domain/ipo/types';
import { addDays, addMonths, startOfDay, startOfMonth } from '@/domain/calendar/utils/date';

export type EarningsView = 'daily' | 'weekly' | 'monthly';

export function getEarningsRange(view: EarningsView, anchorDate: Date) {
  if (view === 'daily') {
    return { from: anchorDate, to: anchorDate };
  }
  if (view === 'weekly') {
    const from = addDays(anchorDate, -anchorDate.getDay());
    const to = addDays(from, 6);
    return { from, to };
  }
  const from = startOfMonth(anchorDate);
  const to = addDays(addMonths(from, 1), -1);
  return { from, to };
}

export function shiftEarningsAnchor(
  view: EarningsView,
  current: Date,
  direction: -1 | 1,
): Date {
  if (view === 'daily') {
    return startOfDay(addDays(current, direction));
  }
  if (view === 'weekly') {
    return startOfDay(addDays(current, direction * 7));
  }
  return startOfDay(addMonths(current, direction));
}

export function canMoveEarningsRange(
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

export function groupEarningsByDate(items: UsEarningsCalendarItem[]) {
  const grouped = new Map<string, UsEarningsCalendarItem[]>();
  items.forEach((item) => {
    const current = grouped.get(item.reportDate) ?? [];
    current.push(item);
    grouped.set(item.reportDate, current);
  });
  // 심볼(ABC) 순으로 정렬해 PC 달력 칸에 앞쪽 한두 개만 보여줄 때 항상 같은 순서가 되게 한다.
  grouped.forEach((dayItems) => {
    dayItems.sort((a, b) => a.symbol.localeCompare(b.symbol));
  });
  return grouped;
}

export function formatEarningsMeta(item: UsEarningsCalendarItem): string {
  const estimate =
    item.estimate !== null && item.currency
      ? `EPS ${item.estimate.toFixed(2)} ${item.currency}`
      : 'EPS -';
  const time = item.timeOfTheDay || 'Time TBD';
  return `${estimate} · ${time}`;
}
