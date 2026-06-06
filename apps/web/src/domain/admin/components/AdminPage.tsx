"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, Moon, Sun, UserPen, X } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { SessionLoading } from "@/common/components/SessionLoading";
import { useMarketDataStore } from "@/common/stores/market-data";
import { useSessionStore } from "@/common/stores/session";
import { apiRequest, User, UserStatus } from "@/lib/api";
import { MarketPulse } from "@/domain/markets/components/MarketPulse";

export function AdminPage() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const authChecking = useSessionStore((s) => s.authChecking);
  const logoutSession = useSessionStore((s) => s.logout);
  const pulse = useMarketDataStore((s) => s.pulse);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const marketLoading = useMarketDataStore((s) => s.marketLoading);
  const loadMarketData = useMarketDataStore((s) => s.loadMarketData);

  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [language, setLanguage] = useState<"en" | "ko">("en");
  const [darkMode, setDarkMode] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("darkMode") === "true",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = user?.role === "ADMIN";
  const menuItems: Array<{ id: "stocks" | "news" | "community" | "admin"; label: string }> = [
    { id: "stocks", label: language === "ko" ? "종목" : "Stocks" },
    { id: "news", label: language === "ko" ? "뉴스" : "News" },
    { id: "community", label: language === "ko" ? "커뮤니티" : "Community" },
    { id: "admin", label: language === "ko" ? "관리자" : "Admin" },
  ];

  const loadPendingUsers = useCallback(async (token = accessToken) => {
    if (!token) {
      return;
    }

    try {
      const users = await apiRequest<User[]>("/users/pending", "GET", {
        accessToken: token,
      });
      setPendingUsers(users);
    } catch (pendingError) {
      setError(
        pendingError instanceof Error
          ? pendingError.message
          : "Could not load pending users.",
      );
    }
  }, [accessToken]);

  useEffect(() => {
    if (!authChecking && user?.status !== "APPROVED") {
      router.replace("/login");
    }
  }, [authChecking, user?.status, router]);

  useEffect(() => {
    if (!authChecking && user?.status === "APPROVED" && !isAdmin) {
      router.replace("/");
    }
  }, [authChecking, isAdmin, user?.status, router]);

  useEffect(() => {
    window.localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (!accessToken || !isAdmin) {
      queueMicrotask(() => setPendingUsers([]));
      return;
    }
    queueMicrotask(() => {
      loadPendingUsers(accessToken);
    });
  }, [accessToken, isAdmin, loadPendingUsers]);

  async function updateUserStatus(id: string, status: UserStatus) {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiRequest<User>(`/users/${id}/status`, "PATCH", {
        accessToken,
        body: { status },
      });
      await loadPendingUsers(accessToken);
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Could not update user status.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await logoutSession();
  }

  if (authChecking || user?.status !== "APPROVED" || !isAdmin) {
    return (
      <main className={`min-h-screen bg-[#f6f7fb] text-[#161a22] ${darkMode ? "dark-app" : ""}`}>
        <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
          <SessionLoading />
        </section>
      </main>
    );
  }

  return (
    <main className={`min-h-screen bg-[#f6f7fb] text-[#161a22] ${darkMode ? "dark-app" : ""}`}>
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
              onClick={() => setLanguage(language === "en" ? "ko" : "en")}
              className="h-10 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold text-[#1f6f8b] shadow-sm hover:bg-[#eef1f6]"
            >
              {language === "en" ? "한국어" : "English"}
            </button>
            <button
              onClick={() => setDarkMode((current) => !current)}
              title={darkMode ? "Light mode" : "Dark mode"}
              aria-label={darkMode ? "Light mode" : "Dark mode"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#c7ceda] bg-white text-[#344052] shadow-sm hover:bg-[#eef1f6]"
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              onClick={() => router.push("/profile")}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold text-[#344052] shadow-sm hover:bg-[#eef1f6]"
            >
              <UserPen size={16} />
              {language === "ko" ? "프로필 수정" : "Profile"}
            </button>
            <button
              onClick={logout}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-medium shadow-sm hover:bg-[#eef1f6]"
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
        />

        <nav className="mt-4 flex gap-2 border-b border-[#d9dee8]">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "admin") {
                  return;
                }
                if (item.id === "community") {
                  router.push("/community");
                  return;
                }
                if (item.id === "news") {
                  router.push("/news");
                  return;
                }
                router.push("/");
              }}
              className={`h-11 border-b-2 px-3 text-sm font-semibold ${
                item.id === "admin"
                  ? "border-[#1f6f8b] text-[#1f6f8b]"
                  : "border-transparent text-[#607086]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {error ? <Notice message="" error={error} /> : null}

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[1fr]">
          <AdminPanel
            pendingUsers={pendingUsers}
            loading={loading}
            updateUserStatus={updateUserStatus}
          />
        </div>
      </section>
    </main>
  );
}

function AdminPanel({
  pendingUsers,
  loading,
  updateUserStatus,
}: {
  pendingUsers: User[];
  loading: boolean;
  updateUserStatus: (id: string, status: UserStatus) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Access approvals</h2>
        <span className="rounded-md bg-[#eef3f8] px-2.5 py-1 text-xs font-semibold text-[#344052]">
          {pendingUsers.length}
        </span>
      </div>
      <div className="mt-4 overflow-hidden rounded-md border border-[#d9dee8]">
        {pendingUsers.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#607086]">
            No pending accounts.
          </div>
        ) : (
          pendingUsers.map((pendingUser) => (
            <div
              key={pendingUser.id}
              className="flex flex-col gap-3 border-b border-[#eef1f6] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{pendingUser.nickname}</p>
                <p className="text-sm text-[#607086]">{pendingUser.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={loading}
                  onClick={() => updateUserStatus(pendingUser.id, "APPROVED")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2e7d4f] px-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Check size={15} />
                  Approve
                </button>
                <button
                  disabled={loading}
                  onClick={() => updateUserStatus(pendingUser.id, "REJECTED")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#d3a1a1] bg-white px-3 text-sm font-semibold text-[#9a2f2f] disabled:opacity-60"
                >
                  <X size={15} />
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
