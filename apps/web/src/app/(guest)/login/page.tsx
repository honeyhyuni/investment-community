"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionLoading } from "@/common/components/SessionLoading";
import { useSessionStore } from "@/common/stores/session";
import { AuthPanel } from "@/domain/auth/components/AuthPanel";
import { PendingPanel } from "@/domain/auth/components/PendingPanel";
import { AuthMode } from "@/domain/auth/types";

const REMEMBER_EMAIL_KEY = "rememberedEmail";

export default function LoginPage() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const authChecking = useSessionStore((s) => s.authChecking);
  const login = useSessionStore((s) => s.login);
  const register = useSessionStore((s) => s.register);

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 이미 승인된 세션이면 앱으로.
  useEffect(() => {
    if (user?.status === "APPROVED") {
      router.replace("/");
    }
  }, [user?.status, router]);

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberEmail(true);
    }
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "register") {
        const { user: registered } = await register(email, password, nickname);
        setMessage(
          registered.status === "APPROVED"
            ? "Admin account created. You can sign in now."
            : "Your request is pending admin approval.",
        );
        setMode("login");
        return;
      }

      await login(email, password);
      if (rememberEmail) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      setMessage("");
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Request failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (authChecking || user?.status === "APPROVED") {
    return <SessionLoading />;
  }

  const heading = mode === "login" ? "Sign in" : "Request access";

  return (
    <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[380px_1fr]">
      <AuthPanel
        mode={mode}
        setMode={setMode}
        email={email}
        setEmail={setEmail}
        rememberEmail={rememberEmail}
        setRememberEmail={setRememberEmail}
        password={password}
        setPassword={setPassword}
        nickname={nickname}
        setNickname={setNickname}
        heading={heading}
        user={user}
        message={message}
        error={error}
        loading={loading}
        submitAuth={submitAuth}
      />
      <PendingPanel user={user} />
    </div>
  );
}
