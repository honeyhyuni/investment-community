import { cn } from "@/common/utils/cn";

export interface SwitchProps {
  /** 켜짐 여부 */
  checked: boolean;
  /** 토글 시 다음 상태(boolean)를 전달 */
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** 스크린리더용 라벨 (가시 라벨이 없을 때 사용) */
  "aria-label"?: string;
  className?: string;
}

/** 체크박스 대체용 토글 스위치. role="switch"로 접근성 제공. */
export function Switch({
  checked,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-border-strong",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
