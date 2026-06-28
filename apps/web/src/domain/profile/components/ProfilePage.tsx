"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, UserPen } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { Button } from "@/common/components/Button";
import { SectionHeader } from "@/common/components/SectionHeader";
import { TextInput } from "@/common/components/TextInput";
import { useSessionStore } from "@/common/stores/session";
import { usePreferencesStore } from "@/common/stores/preferences";
import { apiRequest, User, UserRole, UserStatus } from "@/common/lib/api";
import { NotificationSettings } from "@/domain/notifications/components/NotificationSettings";

export function ProfilePage() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const ko = usePreferencesStore((s) => s.language) === "ko";

  const [nicknameDraft, setNicknameDraft] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        body: { nickname: nicknameDraft.trim() },
      });
      setUser(updatedUser);
      router.replace("/?notice=profile-updated");
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : ko
            ? "프로필을 수정하지 못했습니다."
            : "Could not update profile.",
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
      setError(ko ? "새 비밀번호가 일치하지 않습니다." : "New passwords do not match.");
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
      setMessage(
        ko
          ? "비밀번호를 변경했습니다. 세션이 만료되면 다시 로그인하세요."
          : "Password changed. Sign in again when this session expires.",
      );
    } catch (passwordError) {
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : ko
            ? "비밀번호를 변경하지 못했습니다."
            : "Could not change password.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex-1 py-4 sm:py-6">
      <ProfilePanel
        user={user}
        ko={ko}
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
      {accessToken ? <NotificationSettings accessToken={accessToken} ko={ko} /> : null}
    </div>
  );
}

function ProfilePanel({
  user,
  ko,
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
  ko: boolean;
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
    <section className="-mx-4 border-y border-border bg-surface p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
      <SectionHeader
        eyebrow={ko ? "계정" : "Account"}
        title={ko ? "프로필 수정" : "Edit profile"}
        action={
          <Button variant="secondary" size="sm" leftIcon={<ChevronLeft />} onClick={onBack}>
            {ko ? "뒤로" : "Back"}
          </Button>
        }
      />

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-foreground">
            {ko ? "닉네임" : "Nickname"}
          </span>
          <input
            value={nicknameDraft}
            onChange={(event) => setNicknameDraft(event.target.value)}
            type="text"
            minLength={2}
            maxLength={24}
            required
            className="mt-1 h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-foreground outline-none transition-colors focus:border-primary"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <InfoBox label={ko ? "이메일" : "Email"} value={user.email} />
          <InfoBox label={ko ? "권한" : "Role"} value={roleLabel(user.role, ko)} />
          <InfoBox label={ko ? "상태" : "Status"} value={statusText(user.status, ko)} />
          <InfoBox
            label={ko ? "가입일" : "Joined"}
            value={new Date(user.createdAt).toLocaleDateString(ko ? "ko-KR" : "en-US")}
          />
        </div>

        <Button type="submit" variant="primary" leftIcon={<UserPen />} loading={loading}>
          {ko ? "프로필 저장" : "Save profile"}
        </Button>
      </form>

      <form
        onSubmit={onPasswordSubmit}
        className="mt-6 space-y-4 border-t border-border pt-5"
      >
        <h3 className="text-base font-semibold text-foreground">
          {ko ? "비밀번호 변경" : "Change password"}
        </h3>
        <TextInput
          label={ko ? "현재 비밀번호" : "Current password"}
          value={currentPassword}
          setValue={setCurrentPassword}
          type="password"
          minLength={8}
        />
        <TextInput
          label={ko ? "새 비밀번호" : "New password"}
          value={newPassword}
          setValue={setNewPassword}
          type="password"
          minLength={8}
        />
        <TextInput
          label={ko ? "새 비밀번호 확인" : "Confirm new password"}
          value={confirmPassword}
          setValue={setConfirmPassword}
          type="password"
          minLength={8}
        />
        <Button type="submit" variant="primary" loading={loading}>
          {ko ? "비밀번호 변경" : "Change password"}
        </Button>
      </form>

      <Notice message={message} error={error} />
    </section>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function roleLabel(role: UserRole, ko: boolean): string {
  if (!ko) {
    return role === "ADMIN" ? "Admin" : "User";
  }
  return role === "ADMIN" ? "관리자" : "일반";
}

function statusText(status: UserStatus, ko: boolean): string {
  if (!ko) {
    return status === "APPROVED" ? "Approved" : status === "PENDING" ? "Pending" : "Rejected";
  }
  return status === "APPROVED" ? "승인됨" : status === "PENDING" ? "대기중" : "거절됨";
}
