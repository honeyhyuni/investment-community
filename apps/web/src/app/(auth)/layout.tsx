"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  FileText,
  LogOut,
  MessageSquareText,
  Moon,
  Newspaper,
  ShieldCheck,
  Sun,
  UserPen,
} from "lucide-react";
import { SessionLoading } from "@/common/components/SessionLoading";
import { Button } from "@/common/components/Button";
import { useSessionStore } from "@/common/stores/session";
import { usePreferencesStore } from "@/common/stores/preferences";
import { useMarketDataStore } from "@/common/stores/market-data";
import { MarketPulse } from "@/domain/markets/components/MarketPulse";

const NAV_ITEMS: Array<{
  id: "stocks" | "news" | "marketBriefing" | "community" | "admin";
  href: string;
  label: { en: string; ko: string };
  icon: typeof BarChart3;
  adminOnly?: boolean;
}> = [
  { id: "marketBriefing", href: "/market-briefing", label: { en: "Briefing", ko: "마켓" }, icon: FileText },
  { id: "stocks", href: "/", label: { en: "Stocks", ko: "종목" }, icon: BarChart3 },
  { id: "news", href: "/news", label: { en: "News", ko: "뉴스" }, icon: Newspaper },
  { id: "community", href: "/community", label: { en: "Community", ko: "피드" }, icon: MessageSquareText },
  { id: "admin", href: "/admin", label: { en: "Admin", ko: "관리" }, icon: ShieldCheck, adminOnly: true },
];

/** 승인 유저 전용 셸: 세션가드 + 헤더 + MarketPulse + nav. 라우트 간 유지된다. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const authChecking = useSessionStore((s) => s.authChecking);
  const logout = useSessionStore((s) => s.logout);

  const language = usePreferencesStore((s) => s.language);
  const darkMode = usePreferencesStore((s) => s.darkMode);
  const toggleLanguage = usePreferencesStore((s) => s.toggleLanguage);
  const toggleDarkMode = usePreferencesStore((s) => s.toggleDarkMode);

  const pulse = useMarketDataStore((s) => s.pulse);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const marketLoading = useMarketDataStore((s) => s.marketLoading);
  const exchangeRate = useMarketDataStore((s) => s.exchangeRate);
  const loadMarketData = useMarketDataStore((s) => s.loadMarketData);

  const isAdmin = user?.role === "ADMIN";
  const isProfile = pathname === "/profile";

  useEffect(() => {
    if (!authChecking && user?.status !== "APPROVED") {
      router.replace("/login");
    }
  }, [authChecking, user?.status, router]);

  if (authChecking || user?.status !== "APPROVED") {
    return (
      <main
        className={`min-h-dvh overflow-x-hidden bg-[#f6f7fb] text-[#161a22] ${darkMode ? "dark-app" : ""}`}
      >
        <section className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8 sm:py-6">
          <SessionLoading />
        </section>
      </main>
    );
  }

  return (
    <main
      className={`min-h-dvh overflow-x-hidden bg-[#f6f7fb] text-[#161a22] ${darkMode ? "dark-app" : ""}`}
    >
      <section className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8 sm:py-6">
        <header className="flex flex-col gap-4 border-b border-[#d9dee8] pb-4 sm:flex-row sm:items-center sm:justify-between sm:pb-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[image:var(--primary-gradient)] text-sm font-extrabold tracking-tight text-white shadow-sm">
              15F
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Private
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                Investment Community
              </h1>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Button variant="outline" onClick={toggleLanguage} className="flex-1 sm:flex-none">
              {language === "en" ? "한국어" : "English"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleDarkMode}
              title={darkMode ? "Light mode" : "Dark mode"}
              aria-label={darkMode ? "Light mode" : "Dark mode"}
              leftIcon={darkMode ? <Sun /> : <Moon />}
            />
            <Button
              variant={isProfile ? "primary" : "outline"}
              onClick={() => router.push("/profile")}
              leftIcon={<UserPen />}
              className="flex-1 sm:flex-none"
            >
              {language === "ko" ? "프로필 수정" : "Profile"}
            </Button>
            <Button
              variant="outline"
              onClick={logout}
              leftIcon={<LogOut />}
              className="flex-1 sm:flex-none"
            >
              {language === "ko" ? "로그아웃" : "Logout"}
            </Button>
          </div>
        </header>

        <MarketPulse
          pulse={pulse}
          livePrices={livePrices}
          loading={marketLoading}
          refresh={() => {
            if (accessToken) {
              loadMarketData(accessToken);
            }
          }}
          title={language === "ko" ? "시장 지표" : "Market pulse"}
          refreshLabel={language === "ko" ? "새로고침" : "Refresh"}
          exchangeRate={exchangeRate}
        />

        <nav className="mt-4 hidden gap-2 overflow-x-auto border-b border-[#d9dee8] sm:flex">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex h-11 shrink-0 cursor-pointer items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors ${
                  active
                    ? "border-[#1f6f8b] text-[#1f6f8b]"
                    : "border-transparent text-[#607086] hover:border-[#c7ceda] hover:text-[#1f6f8b]"
                }`}
              >
                {language === "ko" ? item.label.ko : item.label.en}
              </Link>
            );
          })}
        </nav>

        {children}
      </section>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(21,25,35,0.08)] backdrop-blur sm:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          {NAV_ITEMS.filter((item) => !item.adminOnly).map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted hover:text-primary"
                }`}
              >
                <Icon size={19} />
                <span>{language === "ko" ? item.label.ko : item.label.en}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
