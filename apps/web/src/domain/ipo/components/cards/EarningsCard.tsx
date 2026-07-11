'use client';

import { useRouter } from 'next/navigation';

import { UsEarningsCalendarItem } from '@/domain/ipo/types';
import { formatEarningsMeta } from '@/domain/ipo/utils/earningsCalendar';

/** 데일리/주간 리스트에 쓰이는 넓은 카드. */
export function EarningsCard({
  item,
  highlighted,
}: {
  item: UsEarningsCalendarItem;
  highlighted: boolean;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() =>
        router.push(`/?symbol=${encodeURIComponent(item.symbol)}&market=US`)
      }
      className={`min-w-0 cursor-pointer rounded-md border p-3 text-left transition-colors hover:border-primary hover:text-primary ${
        highlighted
          ? 'border-primary bg-primary/10'
          : 'border-border bg-surface'
      }`}
    >
      <p className="text-base font-bold text-foreground">{item.symbol}</p>
      <p className="mt-1 truncate text-sm font-semibold text-muted">
        {item.companyName}
      </p>
      <p className="mt-2 text-xs font-semibold text-primary">
        {formatEarningsMeta(item)}
      </p>
    </button>
  );
}
