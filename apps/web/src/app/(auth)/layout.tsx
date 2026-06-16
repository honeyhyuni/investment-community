"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  FileText,
  LogOut,
  MessageSquareText,
  Moon,
  Newspaper,
  ShieldCheck,
  Star,
  Sun,
  UserPen,
} from "lucide-react";
import { SessionLoading } from "@/common/components/SessionLoading";
import { useSessionStore } from "@/common/stores/session";
import { usePreferencesStore } from "@/common/stores/preferences";
import { useMarketDataStore } from "@/common/stores/market-data";
import { MarketPulse } from "@/domain/markets/components/MarketPulse";

const NAV_ITEMS: Array<{
  id: "stocks" | "favorites" | "news" | "marketBriefing" | "community" | "admin";
  href: string;
  label: { en: string; ko: string };
  icon: typeof BarChart3;
  adminOnly?: boolean;
}> = [
  { id: "marketBriefing", href: "/market-briefing", label: { en: "Briefing", ko: "마켓" }, icon: FileText },
  { id: "stocks", href: "/", label: { en: "Stocks", ko: "종목" }, icon: BarChart3 },
  { id: "favorites", href: "/?mode=favorites", label: { en: "Watchlist", ko: "내관심종목" }, icon: Star },
  { id: "news", href: "/news", label: { en: "News", ko: "뉴스" }, icon: Newspaper },
  { id: "community", href: "/community", label: { en: "Community", ko: "피드" }, icon: MessageSquareText },
  { id: "admin", href: "/admin", label: { en: "Admin", ko: "관리" }, icon: ShieldCheck, adminOnly: true },
];

/** 승인 유저 전용 셸: 세션가드 + 헤더 + MarketPulse + nav. 라우트 간 유지된다. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accountMenuRef = useRef<HTMLDetailsElement>(null);
  const [headerScrolled, setHeaderScrolled] = useState(false);

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
  const accountName = user?.nickname || user?.email || "Account";
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || "U";

  useEffect(() => {
    if (!authChecking && user?.status !== "APPROVED") {
      router.replace("/login");
    }
  }, [authChecking, user?.status, router]);

  useEffect(() => {
    const syncHeaderState = () => {
      setHeaderScrolled(window.scrollY > 12);
    };

    syncHeaderState();
    window.addEventListener("scroll", syncHeaderState, { passive: true });
    return () => window.removeEventListener("scroll", syncHeaderState);
  }, []);

  useEffect(() => {
    const closeAccountMenu = () => {
      if (accountMenuRef.current) {
        accountMenuRef.current.open = false;
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const menu = accountMenuRef.current;
      if (!menu?.open || !(event.target instanceof Node) || menu.contains(event.target)) {
        return;
      }
      closeAccountMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAccountMenu();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (accountMenuRef.current) {
      accountMenuRef.current.open = false;
    }
  }, [pathname]);

  if (authChecking || user?.status !== "APPROVED") {
    return (
      <main
        className={`min-h-dvh overflow-x-clip bg-[#f6f7fb] text-[#161a22] ${darkMode ? "dark-app" : ""}`}
      >
        <section className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8 sm:py-6">
          <SessionLoading />
        </section>
      </main>
    );
  }

  return (
    <main
      className={`min-h-dvh overflow-x-clip bg-[#f6f7fb] text-[#161a22] ${darkMode ? "dark-app" : ""}`}
    >
      <section className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-0 sm:px-8 sm:pb-6">
        <header
          className={`sticky top-0 z-40 w-screen self-center border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
            headerScrolled
              ? darkMode
                ? "border-border bg-surface-muted/85 backdrop-blur-md"
                : "border-border bg-background/70 backdrop-blur-md"
              : "border-border bg-surface/95 shadow-sm"
          }`}
        >
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-8 sm:pb-4 sm:pt-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
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
            </div>
            <div className="flex shrink-0 items-center justify-end gap-3">
              <div
                className="hidden items-center rounded-md border border-border bg-surface p-1 sm:flex"
                aria-label={language === "ko" ? "앱 설정" : "App settings"}
              >
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="flex h-9 min-w-11 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label={language === "ko" ? "Switch to English" : "한국어로 변경"}
                >
                  {language === "en" ? "KO" : "EN"}
                </button>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className="grid size-9 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  title={darkMode ? "Light mode" : "Dark mode"}
                  aria-label={darkMode ? "Light mode" : "Dark mode"}
                >
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>

              <details ref={accountMenuRef} className="group relative">
              <summary
                className={`flex h-11 max-w-52 cursor-pointer list-none items-center gap-2 rounded-md border bg-surface px-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden ${
                  isProfile
                    ? "border-primary text-primary"
                    : "border-border text-foreground hover:border-primary hover:text-primary"
                }`}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {accountInitial}
                </span>
                <span className="hidden min-w-0 max-w-28 truncate sm:block">
                  {accountName}
                </span>
                <ChevronDown
                  size={16}
                  className="shrink-0 text-muted transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-border bg-surface p-1 shadow-lg">
                <div className="border-b border-border px-3 py-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {accountName}
                  </p>
                  {user?.email ? (
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  ) : null}
                </div>
                <div className="border-b border-border py-1 sm:hidden">
                  <button
                    type="button"
                    onClick={toggleLanguage}
                    className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="grid size-5 place-items-center text-xs font-bold">
                      {language === "en" ? "KO" : "EN"}
                    </span>
                    {language === "ko" ? "English" : "한국어"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleDarkMode}
                    className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                    {darkMode
                      ? language === "ko"
                        ? "라이트 모드"
                        : "Light mode"
                      : language === "ko"
                        ? "다크 모드"
                        : "Dark mode"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (accountMenuRef.current) {
                      accountMenuRef.current.open = false;
                    }
                    router.push("/profile");
                  }}
                  className="mt-1 flex h-10 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <UserPen size={16} />
                  {language === "ko" ? "프로필 수정" : "Profile"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (accountMenuRef.current) {
                      accountMenuRef.current.open = false;
                    }
                    logout();
                  }}
                  className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <LogOut size={16} />
                  {language === "ko" ? "로그아웃" : "Logout"}
                </button>
              </div>
            </details>
          </div>
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
          eyebrow={language === "ko" ? "실시간 개요" : "Live overview"}
          refreshLabel={language === "ko" ? "새로고침" : "Refresh"}
          exchangeRate={exchangeRate}
          exchangeRateErrorLabel={
            language === "ko" ? "KIS 환율 조회 실패" : "Exchange rate unavailable"
          }
        />

        <nav className="mt-4 hidden gap-2 overflow-x-auto border-b border-border sm:flex">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const active =
              item.id === "stocks" || item.id === "favorites"
                ? pathname === "/"
                : pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex h-11 shrink-0 cursor-pointer items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:border-border-strong hover:text-primary"
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
        <div
          className={`mx-auto grid h-16 max-w-md ${
            isAdmin ? "grid-cols-5" : "grid-cols-4"
          }`}
        >
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const active =
              item.id === "stocks" || item.id === "favorites"
                ? pathname === "/"
                : pathname === item.href ||
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
