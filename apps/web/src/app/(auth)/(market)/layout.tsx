"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MARKET_TABS } from "@/common/config/marketNav";
import { usePreferencesStore } from "@/common/stores/preferences";

/** "마켓" 그룹 셸: 페이지 콘텐츠 상단에 브리핑/뉴스/캘린더 탭을 붙인다. */
export default function MarketLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ko = usePreferencesStore((s) => s.language) === "ko";

  return (
    <section className="-mx-4 mt-4 min-w-0 border-y border-border bg-surface px-4 pt-3 shadow-sm sm:mx-0 sm:mt-6 sm:rounded-lg sm:border sm:px-5 sm:pt-4">
      <div className="pb-2">
        <h2 className="text-base font-semibold text-foreground">
          {ko ? "마켓" : "Market"}
        </h2>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          {ko
            ? "시장 상황을 한 눈에 파악해 보세요."
            : "Get a clear view of the market at a glance."}
        </p>
      </div>
      <nav className="flex gap-2 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MARKET_TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex h-11 shrink-0 cursor-pointer items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:border-border-strong hover:text-primary"
              }`}
            >
              {ko ? tab.label.ko : tab.label.en}
            </Link>
          );
        })}
      </nav>
      {children}
    </section>
  );
}
