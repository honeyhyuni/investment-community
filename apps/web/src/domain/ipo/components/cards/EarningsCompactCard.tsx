'use client';

import { useRouter } from 'next/navigation';

import { UsEarningsCalendarItem } from '@/domain/ipo/types';

/**
 * 월간 달력 칸 안에 직접 나열되는 티커 전용 축약 카드.
 * 칸 높이가 빠듯해서 티커만 한 줄로 보여준다. 자세한 정보는 EarningsCard(더보기 모달)에서 확인한다.
 */
export function EarningsCompactCard({
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
      className={`flex h-full w-full min-w-0 cursor-pointer items-center justify-center rounded-md border px-1.5 shadow-sm transition-colors ${
        highlighted
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-surface text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary'
      }`}
    >
      <span className="w-full truncate text-center text-[11px] font-bold tracking-wide leading-none sm:text-xs">
        {item.symbol}
      </span>
    </button>
  );
}
