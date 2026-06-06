import { ReactNode } from "react";

/** 비로그인/승인대기 화면용 최소 셸: 타이틀 헤더 + 배경. (auth) 앱 셸과 분리. */
export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f7fb] text-[#161a22]">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-[#d9dee8] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#607086]">
              Private
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">
              Investment Community
            </h1>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
