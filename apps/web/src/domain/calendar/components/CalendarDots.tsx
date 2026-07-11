import { cn } from '@/common/utils/cn';

/**
 * 날짜 칸에 일정 개수를 숫자 대신 점으로 표시하는 모던한 인디케이터.
 * 개수가 많아도 점은 최대 max개까지만 찍는다 (기본 3개).
 */
export function CalendarDots({
  count,
  max = 3,
  label,
  className,
}: {
  count: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  if (count <= 0) {
    return null;
  }

  const dots = Math.min(count, max);

  return (
    <div
      role="img"
      aria-label={label ?? `${count}`}
      className={cn('flex items-center gap-0.5', className)}
    >
      {Array.from({ length: dots }).map((_, index) => (
        <span key={index} className="size-1.5 rounded-full bg-primary" />
      ))}
    </div>
  );
}
