'use client';

import { useRouter } from 'next/navigation';

import { UsEarningsCalendarItem } from '@/domain/ipo/types';
import { formatEarningsMeta } from '@/domain/ipo/utils/earningsCalendar';

/**
 * 월간 달력 칸 안에 들어가는 압축 카드.
 * tickerOnly면 티커만 한 줄로 보여준다 (PC 칸 안에 직접 나열될 때 쓰는 축약형).
 */
export function EarningsCompactCard({
  item,
  highlighted,
  tickerOnly = false,
}: {
  item: UsEarningsCalendarItem;
  highlighted: boolean;
  tickerOnly?: boolean;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() =>
        router.push(`/?symbol=${encodeURIComponent(item.symbol)}&market=US`)
      }
      className={`min-w-0 cursor-pointer rounded-md border text-left transition-colors hover:border-primary hover:text-primary ${
        tickerOnly ? 'px-2 py-1' : 'px-2 py-1.5'
      } ${
        highlighted
          ? 'border-primary bg-primary/10'
          : 'border-border bg-surface'
      }`}
    >
      <p className="truncate text-xs font-bold text-foreground sm:text-sm">
        {item.symbol}
      </p>
      {tickerOnly ? null : (
        <>
          <p className="hidden truncate text-[11px] font-semibold text-muted sm:block">
            {item.companyName}
          </p>
          <p className="mt-1 truncate text-[10px] font-semibold text-primary sm:text-[11px]">
            {formatEarningsMeta(item)}
          </p>
        </>
      )}
    </button>
  );
}
