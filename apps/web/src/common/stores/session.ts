import { create } from "zustand";
import { apiRequest, AuthResponse, User } from "@/lib/api";

type SessionState = {
  accessToken: string | null;
  user: User | null;
  authChecking: boolean;
  /** 앱 로드 시 1회. refresh 토큰으로 세션 복원. 성공/실패 무관하게 authChecking 종료. */
  refresh: () => Promise<void>;
  /** 로그인. 성공 시 토큰+유저 세팅, 실패 시 throw (호출부가 메시지 처리). */
  login: (email: string, password: string) => Promise<User>;
  /** 가입 요청. 토큰은 세팅하지 않음(승인 대기). user + 안내 메시지 반환. */
  register: (
    email: string,
    password: string,
    nickname: string,
  ) => Promise<{ user: User; message: string }>;
  /** 로그아웃. 서버 세션 폐기 후 로컬 세션 클리어. */
  logout: () => Promise<void>;
  /** /auth/me로 세션 유효성 확인. 실패 시 세션 클리어. */
  verify: () => Promise<void>;
  /** 프로필 수정 등으로 갱신된 유저 반영. */
  setUser: (user: User) => void;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  accessToken: null,
  user: null,
  authChecking: true,

  refresh: async () => {
    try {
      const response = await apiRequest<AuthResponse>("/auth/refresh", "POST");
      set({ accessToken: response.accessToken, user: response.user });
    } catch {
      // 비로그인 상태 — 무시
    } finally {
      set({ authChecking: false });
    }
  },

  login: async (email, password) => {
    const response = await apiRequest<AuthResponse>("/auth/login", "POST", {
      body: { email, password },
    });
    set({ accessToken: response.accessToken, user: response.user });
    return response.user;
  },

  register: async (email, password, nickname) => {
    const response = await apiRequest<{ user: User; message: string }>(
      "/auth/register",
      "POST",
      { body: { email, password, nickname } },
    );
    set({ user: response.user });
    return response;
  },

  logout: async () => {
    const { accessToken } = get();
    if (accessToken) {
      await apiRequest<{ ok: boolean }>("/auth/logout", "POST", {
        accessToken,
      }).catch(() => undefined);
    }
    set({ accessToken: null, user: null });
  },

  verify: async () => {
    const { accessToken } = get();
    if (!accessToken) {
      return;
    }
    try {
      await apiRequest<User>("/auth/me", "GET", { accessToken });
    } catch {
      set({ accessToken: null, user: null });
    }
  },

  setUser: (user) => set({ user }),
}));
