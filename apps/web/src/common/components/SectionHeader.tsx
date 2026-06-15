import type { ReactNode } from "react";

import { cn } from "@/common/utils/cn";

export interface SectionHeaderProps {
  /** 타이틀 위에 오는 작은 대문자 라벨 (eyebrow/subtitle). */
  eyebrow: ReactNode;
  /** 섹션 제목. */
  title: ReactNode;
  /** 오른쪽 끝에 붙는 액션/배지 슬롯 (새로고침 버튼·카운트 배지 등). */
  action?: ReactNode;
  /** 래퍼에 덧붙일 클래스 (하단 여백 등). */
  className?: string;
}

/**
 * 섹션 공통 헤더. Market Pulse 헤더와 동일한 (eyebrow → title) 구조를 단일 소스로 제공한다.
 * 새 섹션은 이 컴포넌트를 써서 헤더 디자인을 일관되게 맞춘다.
 */
export function SectionHeader({ eyebrow, title, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          {eyebrow}
        </p>
        <h2 className="mt-0.5 text-base font-semibold text-foreground">{title}</h2>
      </div>
      {action}
    </div>
  );
}
