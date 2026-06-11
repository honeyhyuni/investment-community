import { ReactNode } from "react";

/** 비로그인/승인대기 화면용 최소 셸: 타이틀 헤더 + 배경. (auth) 앱 셸과 분리. */
export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#f6f7fb] text-[#161a22]">
      <section className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8 sm:py-6">
        <header className="flex flex-col gap-4 border-b border-[#d9dee8] pb-4 sm:flex-row sm:items-center sm:justify-between sm:pb-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#607086]">
              Private
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-normal sm:text-2xl">
              Investment Community
            </h1>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
