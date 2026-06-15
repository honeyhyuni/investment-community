import { cn } from "@/common/utils/cn";

/**
 * 로딩 플레이스홀더 블록. 실제 콘텐츠와 같은 크기로 두어 레이아웃 시프트를 막는다.
 * 색은 토큰(`surface-subtle`), 애니메이션은 Tailwind 기본 `animate-pulse`.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-surface-subtle", className)}
    />
  );
}
