import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

import { cn } from "@/common/utils/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "ghost-danger"
  | "danger"
  | "link";
/** `icon`/`icon-sm` = 정사각형 아이콘 전용 (아이콘은 `leftIcon`으로 넘기고 children은 비운다). */
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 로딩 중: 스피너 표시 + 클릭 비활성화. */
  loading?: boolean;
  /** 텍스트 앞 아이콘 (로딩 중엔 콘텐츠 전체가 스피너로 가려짐). */
  leftIcon?: ReactNode;
  /** 텍스트 뒤 아이콘. */
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const BASE =
  "transition-colors select-none font-semibold [&_svg]:size-[1.2em] [&_svg]:shrink-0 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** link를 제외한 모든 variant의 공통 형태 (높이/패딩은 SIZE가 담당). */
const SHAPE = "inline-flex items-center justify-center rounded-md";

// hover는 `enabled:`로 묶어 disabled/loading 상태에선 호버 스타일이 적용되지 않게 한다.
const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary enabled:hover:bg-primary-hover",
  secondary: "border border-border bg-surface text-foreground enabled:hover:bg-surface-muted",
  outline: "border border-border bg-surface text-primary enabled:hover:border-primary enabled:hover:bg-surface-muted",
  ghost: "text-foreground enabled:hover:bg-surface-muted",
  "ghost-danger": "text-negative enabled:hover:bg-negative-surface",
  danger: "bg-negative text-white enabled:hover:opacity-90",
  link: "text-primary underline-offset-2 enabled:hover:underline",
};

// 반응형: 모바일은 터치 타깃을 크게(1차 h-11 / 2차 h-10), 데스크톱(sm:)은 한 단계 컴팩트하게.
// 프로젝트 전반의 입력창/버튼 컨벤션(h-11→sm:h-10, h-10→sm:h-9)과 동일.
const SIZE: Record<ButtonSize, string> = {
  sm: "h-10 gap-1.5 px-3 text-xs sm:h-9",
  md: "h-11 gap-2 px-4 text-sm sm:h-10",
  lg: "h-12 gap-2 px-5 text-base sm:h-11",
  icon: "size-11 text-base sm:size-10",
  "icon-sm": "size-10 text-sm sm:size-9",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  type,
  className,
  children,
  ref,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const isLink = variant === "link";

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        BASE,
        "relative",
        !isLink && SHAPE,
        !isLink && SIZE[size],
        VARIANT[variant],
        fullWidth && "w-full",
        !isDisabled && "cursor-pointer",
        loading && "cursor-progress",
        isDisabled && !loading && "cursor-not-allowed opacity-60",
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
      {/* display:contents → 평소엔 leftIcon/children/rightIcon이 버튼의 flex 아이템.
          로딩 중엔 invisible로 폭만 유지하고 위 스피너가 가린다. */}
      <span className={cn("contents", loading && "invisible")}>
        {leftIcon}
        {children}
        {rightIcon}
      </span>
    </button>
  );
}

function Spinner() {
  // will-change-transform → 별도 GPU 레이어로 승격해 로딩 중 메인스레드 부하와
  // 무관하게 컴포지터에서 부드럽게 회전. transform-origin은 svg 박스 중심 고정.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="animate-spin will-change-transform [transform-origin:center]"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
