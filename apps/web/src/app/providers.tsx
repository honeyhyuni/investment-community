"use client";

import { ReactNode, useEffect } from "react";
import { useSessionStore } from "@/common/stores/session";

/**
 * 라우트 위에서 살아야 하는 세션 라이프사이클을 한 곳에서 관리한다.
 * - 앱 로드 시 refresh로 세션 복원
 * - 로그인 상태에서 /auth/me 폴링(+focus/visibility)으로 세션 유효성 검증
 */
export function Providers({ children }: { children: ReactNode }) {
  const accessToken = useSessionStore((s) => s.accessToken);
  const refresh = useSessionStore((s) => s.refresh);
  const verify = useSessionStore((s) => s.verify);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
