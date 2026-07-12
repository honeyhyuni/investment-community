'use client';

import type { ReactNode } from 'react';

import { cn } from '@/common/utils/cn';

/**
 * 클릭하면 다른 화면(주로 종목 상세)으로 이동하는 카드의 공통 호버 패턴.
 * 카드 전체를 버튼으로 감싸고, 호버하면 살짝 떠오르면서(-translate-y) 블러 오버레이 +
 * 라벨("종목 상세 보기" 등)이 뜬다. 즐겨찾기 카드, 실적 발표 카드 등에서 재사용한다.
 *
 * className으로 넘긴 값이 카드 자체의 모양(둥근 정도·보더·배경·내부 레이아웃)을 결정하고,
 * 이 컴포넌트는 호버 인터랙션(살짝 떠오름 + 블러 오버레이)만 공통으로 책임진다.
 */
export function HoverNavigateCard({
  onClick,
  label,
  className,
  children,
}: {
  onClick: () => void;
  /** 호버 시 블러 오버레이에 뜨는 라벨. 보통 "종목 상세 보기" / "View stock details". */
  label: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full min-w-0 cursor-pointer overflow-hidden text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      {children}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/50 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
    </button>
  );
}
