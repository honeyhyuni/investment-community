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
  /** 텍스트 앞 아이콘 (로딩 중엔 스피너로 대체됨). */
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

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "border border-border bg-surface text-foreground hover:bg-surface-muted",
  outline: "border border-border bg-surface text-primary hover:border-primary hover:bg-surface-muted",
  ghost: "text-foreground hover:bg-surface-muted",
  "ghost-danger": "text-negative hover:bg-negative-surface",
  danger: "bg-negative text-white hover:opacity-90",
  link: "text-primary underline-offset-2 hover:underline",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 px-3 text-xs",
  md: "h-11 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-5 text-base",
  icon: "size-11 text-base",
  "icon-sm": "size-9 text-sm",
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
      {loading ? <Spinner /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
