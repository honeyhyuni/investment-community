import { Skeleton } from '@/common/components/Skeleton';
import { cn } from '@/common/utils/cn';

/**
 * 달력형(월간 그리드) 로딩 상태. 실제 Calendar 컴포넌트와 같은 구조(네비게이션 바 +
 * 요일 헤더 + 고정 높이 42칸)로 그려서 로딩이 끝나도 레이아웃이 튀지 않게 한다.
 */
export function CalendarSkeleton() {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-28 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-8 rounded-md" />
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: 42 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-md sm:h-56" />
        ))}
      </div>
    </div>
  );
}

/**
 * 목록형(날짜별 섹션 + 카드 그리드) 로딩 상태.
 * `boxed=false`(기본): IpoEventList처럼 구분선으로만 나눈 모양.
 * `boxed=true`: EarningsList처럼 날짜별로 테두리 박스에 담긴 모양.
 */
export function CalendarListSkeleton({
  groups = 3,
  cardsPerGroup = 3,
  cardClassName = 'h-20',
  boxed = false,
}: {
  groups?: number;
  cardsPerGroup?: number;
  cardClassName?: string;
  boxed?: boolean;
}) {
  return (
    <div className={cn('mt-4', boxed && 'grid gap-3')}>
      {Array.from({ length: groups }).map((_, groupIndex) => (
        <div
          key={groupIndex}
          className={cn(
            boxed
              ? 'rounded-md border border-border bg-surface-muted p-3'
              : groupIndex > 0 && 'mt-6 border-t border-border pt-6',
          )}
        >
          <div
            className={cn(
              'flex items-baseline gap-2',
              boxed && 'justify-between',
            )}
          >
            <Skeleton
              className={boxed ? 'h-5 w-28 rounded-md' : 'h-6 w-32 rounded-md'}
            />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: cardsPerGroup }).map((_, cardIndex) => (
              <Skeleton
                key={cardIndex}
                className={`${cardClassName} rounded-md`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
