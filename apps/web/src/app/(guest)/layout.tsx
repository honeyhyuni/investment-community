import { ReactNode } from "react";

/** 비로그인/승인대기 화면용 최소 셸: 타이틀 헤더 + 배경. (auth) 앱 셸과 분리. */
export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8 sm:py-6">
        {children}
      </section>
    </main>
  );
}
