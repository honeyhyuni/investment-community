"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Moon, Sun, UserPen } from "lucide-react";
import { SessionLoading } from "@/common/components/SessionLoading";
import { useSessionStore } from "@/common/stores/session";
import { usePreferencesStore } from "@/common/stores/preferences";
import { useMarketDataStore } from "@/common/stores/market-data";
import { MarketPulse } from "@/domain/markets/components/MarketPulse";

const NAV_ITEMS: Array<{
  id: "stocks" | "news" | "marketBriefing" | "community" | "admin";
  href: string;
  label: { en: string; ko: string };
  adminOnly?: boolean;
}> = [
  { id: "marketBriefing", href: "/market-briefing", label: { en: "Market Briefing", ko: "마켓 브리핑" } },
  { id: "stocks", href: "/", label: { en: "Stocks", ko: "종목" } },
  { id: "news", href: "/news", label: { en: "News", ko: "뉴스" } },
  { id: "community", href: "/community", label: { en: "Community", ko: "커뮤니티" } },
  { id: "admin", href: "/admin", label: { en: "Admin", ko: "관리자" }, adminOnly: true },
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
        className={`min-h-screen bg-[#f6f7fb] text-[#161a22] ${darkMode ? "dark-app" : ""}`}
      >
        <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
          <SessionLoading />
        </section>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen bg-[#f6f7fb] text-[#161a22] ${darkMode ? "dark-app" : ""}`}
    >
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
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="h-10 cursor-pointer rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold text-[#1f6f8b] shadow-sm transition-colors hover:border-[#1f6f8b] hover:bg-[#eef1f6]"
            >
              {language === "en" ? "한국어" : "English"}
            </button>
            <button
              onClick={toggleDarkMode}
              title={darkMode ? "Light mode" : "Dark mode"}
              aria-label={darkMode ? "Light mode" : "Dark mode"}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-[#c7ceda] bg-white text-[#344052] shadow-sm transition-colors hover:border-[#1f6f8b] hover:bg-[#eef1f6] hover:text-[#1f6f8b]"
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              onClick={() => router.push("/profile")}
              className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold shadow-sm transition-colors hover:bg-[#eef1f6] ${
                isProfile
                  ? "border-[#1f6f8b] bg-[#eef6f9] text-[#1f6f8b]"
                  : "border-[#c7ceda] bg-white text-[#344052] hover:border-[#1f6f8b] hover:text-[#1f6f8b]"
              }`}
            >
              <UserPen size={16} />
              {language === "ko" ? "프로필 수정" : "Profile"}
            </button>
            <button
              onClick={logout}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-medium shadow-sm transition-colors hover:border-[#9a2f2f] hover:bg-[#fff1f1] hover:text-[#9a2f2f]"
            >
              <LogOut size={16} />
              {language === "ko" ? "로그아웃" : "Logout"}
            </button>
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

        <nav className="mt-4 flex gap-2 border-b border-[#d9dee8]">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`h-11 cursor-pointer border-b-2 px-3 text-sm font-semibold transition-colors ${
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
    </main>
  );
}
