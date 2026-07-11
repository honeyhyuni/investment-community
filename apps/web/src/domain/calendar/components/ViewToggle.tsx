import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/common/utils/cn';

export interface ViewToggleOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ComponentType<{ size?: number }>;
}

interface ViewToggleProps<T extends string> {
  options: ViewToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label'?: string;
  className?: string;
}

/**
 * SegmentedControl보다 한 단계 낮은 "보조" 토글. 상위 탭(공모주/실적 발표)과
 * 시각적으로 구분되도록 작고 테두리 위주의 디자인을 쓴다. (달력형/목록형 같은 하위 뷰 전환용)
 */
export function ViewToggle<T extends string>({
  options,
  value,
  onChange,
  className,
  ...rest
}: ViewToggleProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
              active
                ? 'bg-surface-subtle text-foreground'
                : 'text-muted hover:text-foreground',
            )}
          >
            {Icon ? <Icon size={13} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
