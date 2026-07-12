import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/common/utils/cn';

/**
 * 앱 전반에서 쓰는 "비어 있음" 상태 공통 디자인. 점선 테두리 박스 안에 아이콘 + 제목 +
 * (선택) 본문을 가운데 정렬로 보여준다. 즐겨찾기/포트폴리오 빈 상태에서 쓰던 모양을
 * 재사용 가능한 컴포넌트로 뽑았다.
 */
export function EmptyState({
  icon: Icon,
  iconClassName,
  iconFill,
  iconSize = 28,
  title,
  body,
  className,
  children,
}: {
  /** 없으면 아이콘 없이 제목/본문만 보여준다 (좀 더 절제된 느낌이 필요할 때). */
  icon?: ComponentType<{ size?: number; className?: string; fill?: string }>;
  /** 아이콘 색. 기본은 primary. 즐겨찾기의 별 아이콘처럼 브랜드 색을 쓰고 싶을 때 넘긴다. */
  iconClassName?: string;
  /** 채워진 아이콘(예: 별)을 쓰고 싶을 때 'currentColor' 등을 넘긴다. */
  iconFill?: string;
  iconSize?: number;
  title: string;
  body?: string;
  className?: string;
  /** 본문 아래에 넣을 CTA 버튼 등. */
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-dashed border-border bg-surface-muted px-4 py-10 text-center',
        className,
      )}
    >
      {Icon ? (
        <Icon
          size={iconSize}
          fill={iconFill}
          className={cn('mx-auto text-primary', iconClassName)}
        />
      ) : null}
      <p className={cn('text-sm font-semibold text-foreground', Icon && 'mt-3')}>
        {title}
      </p>
      {body ? <p className="mt-1 text-sm text-muted">{body}</p> : null}
      {children}
    </div>
  );
}
