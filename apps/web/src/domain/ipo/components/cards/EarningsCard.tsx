'use client';

import { useRouter } from 'next/navigation';

import { UsEarningsCalendarItem } from '@/domain/ipo/types';
import {
  formatEarningsEstimate,
  formatEarningsSession,
} from '@/domain/ipo/utils/earningsCalendar';

/**
 * 데일리/주간 리스트, 월간 '더보기' 모달에서 공통으로 쓰는 실적 카드.
 * 티커/회사명은 왼쪽, EPS 추정치는 오른쪽에 정렬해 한눈에 훑어보기 쉽게 한다.
 */
export function EarningsCard({
  item,
  highlighted,
  language,
}: {
  item: UsEarningsCalendarItem;
  highlighted: boolean;
  language: 'en' | 'ko';
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() =>
        router.push(`/?symbol=${encodeURIComponent(item.symbol)}&market=US`)
      }
      className={`flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
        highlighted
          ? 'border-primary bg-primary/10'
          : 'border-border bg-surface hover:border-primary hover:bg-primary/5'
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-base font-bold text-foreground">{item.symbol}</p>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              highlighted
                ? 'bg-primary/15 text-primary'
                : 'bg-surface-subtle text-muted'
            }`}
          >
            {formatEarningsSession(item.timeOfTheDay, language)}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-muted">
          {item.companyName}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] font-semibold text-muted">
          {language === 'ko' ? 'EPS 추정치' : 'EPS est.'}
        </p>
        <p className="mt-0.5 text-sm font-bold text-primary">
          {formatEarningsEstimate(item, language)}
        </p>
      </div>
    </button>
  );
}
