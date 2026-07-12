import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/common/utils/cn';

type CalendarRangeNavProps = {
  label: ReactNode;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  prevAriaLabel: string;
  nextAriaLabel: string;
  className?: string;
};

const NAV_BUTTON_CLASS =
  'grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border bg-surface text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground';

/** 공모주/실적 달력이 공유하는 현재 범위 라벨(강조) + 바로 옆 이전·다음 네비게이션. */
export function CalendarRangeNav({
  label,
  onPrev,
  onNext,
  canPrev,
  canNext,
  prevAriaLabel,
  nextAriaLabel,
  className,
}: CalendarRangeNavProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <p className="text-lg font-bold text-foreground sm:text-xl">{label}</p>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label={prevAriaLabel}
          className={NAV_BUTTON_CLASS}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label={nextAriaLabel}
          className={NAV_BUTTON_CLASS}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
