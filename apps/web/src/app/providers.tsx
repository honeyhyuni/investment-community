"use client";

import { ReactNode, useEffect } from "react";
import { io } from "socket.io-client";
import { API_ORIGIN } from "@/common/lib/api";
import { MarketQuote, TradeTick } from "@/common/types";
import { useSessionStore } from "@/common/stores/session";
import { useMarketDataStore } from "@/common/stores/market-data";
import { usePreferencesStore } from "@/common/stores/preferences";

/**
 * 라우트 위에서 살아야 하는 전역 라이프사이클을 한 곳에서 관리한다.
 * - 세션: 앱 로드 시 refresh, 로그인 상태에서 /auth/me 폴링(+focus/visibility) 검증
 * - 마켓: 승인 유저일 때 시세 일괄 로드 + market:trade 웹소켓 구독
 */
export function Providers({ children }: { children: ReactNode }) {
  const accessToken = useSessionStore((s) => s.accessToken);
  const status = useSessionStore((s) => s.user?.status);
  const refresh = useSessionStore((s) => s.refresh);
  const verify = useSessionStore((s) => s.verify);
  const loadMarketData = useMarketDataStore((s) => s.loadMarketData);
  const applyTrade = useMarketDataStore((s) => s.applyTrade);
  const applyPulse = useMarketDataStore((s) => s.applyPulse);
  const hydratePreferences = usePreferencesStore((s) => s.hydrate);
  const darkMode = usePreferencesStore((s) => s.darkMode);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    hydratePreferences();
  }, [hydratePreferences]);

  // 상태바(theme-color)를 다크 토글에 맞춰 페이지 배경과 동기화.
  // 다크모드는 수동 토글(prefers-color-scheme 미사용)이라 동적 갱신이 필요.
  // 값은 globals.css의 --background 라이트/다크 토큰과 일치.
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", darkMode ? "#11151b" : "#f7f8fb");
  }, [darkMode]);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA installability should never block the app shell.
      });
    });
  }, []);

  useEffect(() => {
    if (!accessToken || status !== "APPROVED") {
      return;
    }

    let active = true;
    const socket = io(API_ORIGIN, {
      transports: ["websocket"],
      withCredentials: true,
    });

    loadMarketData(accessToken).then((symbols) => {
      if (active && symbols.length > 0) {
        socket.emit("market:subscribe", { symbols });
      }
    });
    socket.on("market:trade", (tick: TradeTick) => applyTrade(tick));
    socket.on("market:pulse", (pulse: MarketQuote[]) => applyPulse(pulse));
    const subscribe = (event: Event) => {
      const symbols = (event as CustomEvent<string[]>).detail;
      if (symbols?.length) {
        socket.emit("market:subscribe", { symbols });
      }
    };
    window.addEventListener("market:subscribe", subscribe);

    return () => {
      active = false;
      window.removeEventListener("market:subscribe", subscribe);
      socket.disconnect();
    };
  }, [accessToken, status, loadMarketData, applyTrade, applyPulse]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let lastVerifiedAt = 0;
    const verifyIfNeeded = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastVerifiedAt < 5 * 60_000) {
        return;
      }
      lastVerifiedAt = Date.now();
      void verify();
    };
    const interval = window.setInterval(verifyIfNeeded, 5 * 60_000);
    window.addEventListener("focus", verifyIfNeeded);
    document.addEventListener("visibilitychange", verifyIfNeeded);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", verifyIfNeeded);
      document.removeEventListener("visibilitychange", verifyIfNeeded);
    };
  }, [accessToken, verify]);

  return <>{children}</>;
}
