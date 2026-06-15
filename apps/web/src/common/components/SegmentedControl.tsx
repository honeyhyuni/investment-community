import type { ReactNode } from "react";

import { cn } from "@/common/utils/cn";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 스크린리더용 그룹 라벨. */
  "aria-label"?: string;
  /** 컨테이너에 덧붙일 클래스 (반응형 폭 등). 기본은 모바일 풀폭, 데스크톱은 `sm:inline-flex`로 콘텐츠 폭. */
  className?: string;
  /** 각 탭 버튼에 덧붙일 클래스. 특정 화면의 breakpoint 폭 보정에 사용한다. */
  buttonClassName?: string;
}

/**
 * 뷰 전환용 세그먼티드 컨트롤 (탭). 알약 컨테이너 안에서 active 항목만 떠오른다.
 * 클릭 가능한 "액션"이 아니라 "현재 보고 있는 뷰" 선택이므로 Button 컴포넌트가 아닌 tablist로 구현한다.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  buttonClassName,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      className={cn("flex gap-1 rounded-xl bg-surface-subtle p-1", className)}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 cursor-pointer whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all sm:flex-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface-subtle",
              active
                ? "bg-surface text-primary shadow-sm"
                : "text-muted hover:bg-surface/60",
              buttonClassName,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
