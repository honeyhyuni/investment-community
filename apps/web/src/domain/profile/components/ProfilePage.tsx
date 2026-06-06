"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun, UserPen } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { SessionLoading } from "@/common/components/SessionLoading";
import { statusLabel } from "@/common/components/StatusBadge";
import { TextInput } from "@/common/components/TextInput";
import { useMarketDataStore } from "@/common/stores/market-data";
import { useSessionStore } from "@/common/stores/session";
import { apiRequest, User } from "@/lib/api";
import { MarketPulse } from "@/domain/markets/components/MarketPulse";

export function ProfilePage() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const authChecking = useSessionStore((s) => s.authChecking);
  const setUser = useSessionStore((s) => s.setUser);
  const logoutSession = useSessionStore((s) => s.logout);
  const pulse = useMarketDataStore((s) => s.pulse);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const marketLoading = useMarketDataStore((s) => s.marketLoading);
  const loadMarketData = useMarketDataStore((s) => s.loadMarketData);

  const [language, setLanguage] = useState<"en" | "ko">("en");
  const [darkMode, setDarkMode] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("darkMode") === "true",
  );
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === "ADMIN";
  const menuItems: Array<{ id: "stocks" | "news" | "community" | "admin"; label: string }> = [
    { id: "stocks", label: language === "ko" ? "종목" : "Stocks" },
    { id: "news", label: language === "ko" ? "뉴스" : "News" },
    { id: "community", label: language === "ko" ? "커뮤니티" : "Community" },
    { id: "admin", label: language === "ko" ? "관리자" : "Admin" },
  ];

  useEffect(() => {
    if (!authChecking && user?.status !== "APPROVED") {
      router.replace("/login");
    }
  }, [authChecking, user?.status, router]);

  useEffect(() => {
    window.localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (user) {
      queueMicrotask(() => setNicknameDraft(user.nickname));
    }
  }, [user]);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const updatedUser = await apiRequest<User>("/auth/me", "PATCH", {
        accessToken,
        body: { nickname: nicknameDraft },
      });
      setUser(updatedUser);
      setMessage("Profile updated.");
    } catch (profileError) {
      setError(
        profileError instanceof Error ? profileError.message : "Could not update profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      await apiRequest<{ ok: true }>("/auth/password", "PATCH", {
        accessToken,
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed. Sign in again when this session expires.");
    } catch (passwordError) {
      setError(
        passwordError instanceof Error ? passwordError.message : "Could not change password.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await logoutSession();
  }

  if (authChecking || user?.status !== "APPROVED") {
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
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-[#1f6f8b] bg-[#eef6f9] px-3 text-sm font-semibold text-[#1f6f8b] shadow-sm">
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
          {menuItems
            .filter((item) => item.id !== "admin" || isAdmin)
            .map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "community") {
                    router.push("/community");
                    return;
                  }
                  if (item.id === "news") {
                    router.push("/news");
                    return;
                  }
                  if (item.id === "admin") {
                    router.push("/admin");
                    return;
                  }
                  router.push("/");
                }}
                className="h-11 border-b-2 border-transparent px-3 text-sm font-semibold text-[#607086]"
              >
                {item.label}
              </button>
            ))}
        </nav>

        <div className="flex-1 py-6">
          <ProfilePanel
            user={user}
            nicknameDraft={nicknameDraft}
            setNicknameDraft={setNicknameDraft}
            loading={loading}
            message={message}
            error={error}
            onSubmit={updateProfile}
            currentPassword={currentPassword}
            setCurrentPassword={setCurrentPassword}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            onPasswordSubmit={changePassword}
            onBack={() => router.push("/")}
          />
        </div>
      </section>
    </main>
  );
}

function ProfilePanel({
  user,
  nicknameDraft,
  setNicknameDraft,
  loading,
  message,
  error,
  onSubmit,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  onPasswordSubmit,
  onBack,
}: {
  user: User;
  nicknameDraft: string;
  setNicknameDraft: (value: string) => void;
  loading: boolean;
  message: string;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  onPasswordSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onBack: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#607086]">
            Profile
          </p>
          <h2 className="mt-1 text-xl font-semibold">Edit profile</h2>
        </div>
        <button
          onClick={onBack}
          className="rounded-md border border-[#c7ceda] bg-white px-3 py-2 text-sm font-semibold text-[#344052] hover:bg-[#eef1f6]"
        >
          Back
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-[#344052]">Nickname</span>
          <input
            value={nicknameDraft}
            onChange={(event) => setNicknameDraft(event.target.value)}
            type="text"
            minLength={2}
            maxLength={24}
            required
            className="mt-1 h-11 w-full rounded-md border border-[#c7ceda] px-3 outline-none focus:border-[#1f6f8b]"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <InfoBox label="Email" value={user.email} />
          <InfoBox label="Role" value={user.role} />
          <InfoBox label="Status" value={statusLabel[user.status]} />
          <InfoBox label="Joined" value={new Date(user.createdAt).toLocaleDateString()} />
        </div>

        <button
          disabled={loading}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-[#1f6f8b] px-4 text-sm font-semibold text-white hover:bg-[#195b72] disabled:opacity-60"
        >
          <UserPen size={16} />
          {loading ? "Saving" : "Save profile"}
        </button>
      </form>

      <form onSubmit={onPasswordSubmit} className="mt-6 space-y-4 border-t border-[#eef1f6] pt-5">
        <h3 className="text-base font-semibold">Change password</h3>
        <TextInput
          label="Current password"
          value={currentPassword}
          setValue={setCurrentPassword}
          type="password"
          minLength={8}
        />
        <TextInput
          label="New password"
          value={newPassword}
          setValue={setNewPassword}
          type="password"
          minLength={8}
        />
        <TextInput
          label="Confirm new password"
          value={confirmPassword}
          setValue={setConfirmPassword}
          type="password"
          minLength={8}
        />
        <button
          disabled={loading}
          className="inline-flex h-11 items-center rounded-md bg-[#1f6f8b] px-4 text-sm font-semibold text-white hover:bg-[#195b72] disabled:opacity-60"
        >
          {loading ? "Saving" : "Change password"}
        </button>
      </form>

      <Notice message={message} error={error} />
    </section>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#d9dee8] bg-[#f9fafc] p-3">
      <p className="text-xs text-[#607086]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
