import { ReactNode } from "react";
import Image from "next/image";

/** 비로그인/승인대기 화면용 최소 셸: 타이틀 헤더 + 배경. (auth) 앱 셸과 분리. */
export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <section className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-0 sm:px-8 sm:pb-6">
        <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-border bg-surface/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] shadow-sm backdrop-blur sm:-mx-8 sm:px-8 sm:pb-4 sm:pt-4">
          <Image
            src="/icons/icon.svg"
            width={40}
            height={40}
            alt="15F"
            className="size-10 shrink-0 rounded-lg shadow-sm"
            priority
          />
          <div className="min-w-0 leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Private
            </p>
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
              Investment Community
            </h1>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
