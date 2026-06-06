"use client";

import { ReactNode, useEffect } from "react";
import { io } from "socket.io-client";
import { API_ORIGIN } from "@/lib/api";
import { TradeTick } from "@/common/types";
import { useSessionStore } from "@/common/stores/session";
import { useMarketDataStore } from "@/common/stores/market-data";

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

  useEffect(() => {
    refresh();
  }, [refresh]);

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

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [accessToken, status, loadMarketData, applyTrade]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const interval = window.setInterval(verify, 5000);
    window.addEventListener("focus", verify);
    document.addEventListener("visibilitychange", verify);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", verify);
      document.removeEventListener("visibilitychange", verify);
    };
  }, [accessToken, verify]);

  return <>{children}</>;
}
