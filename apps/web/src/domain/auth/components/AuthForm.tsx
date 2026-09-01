import { FormEvent } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/common/components/Button";
import { TextInput } from "@/common/components/TextInput";
import { AuthMode } from "@/domain/auth/types";

export function AuthForm({
  mode,
  setMode,
  email,
  setEmail,
  rememberEmail,
  setRememberEmail,
  password,
  setPassword,
  nickname,
  setNickname,
  loading,
  submitAuth,
}: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  email: string;
  setEmail: (value: string) => void;
  rememberEmail: boolean;
  setRememberEmail: (value: boolean) => void;
  password: string;
  setPassword: (value: string) => void;
  nickname: string;
  setNickname: (value: string) => void;
  loading: boolean;
  submitAuth: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <>
      <div className="mt-4 grid grid-cols-2 rounded-md border border-border bg-surface-muted p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors ${
            mode === "login"
              ? "bg-surface text-primary shadow-sm"
              : "text-muted hover:text-primary"
          }`}
        >
          <ShieldCheck size={15} />
          로그인
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors ${
            mode === "register"
              ? "bg-surface text-primary shadow-sm"
              : "text-muted hover:text-primary"
          }`}
        >
          <UserPlus size={15} />
          가입 요청
        </button>
      </div>

      <form onSubmit={submitAuth} className="mt-4 space-y-3">
        {mode === "register" ? (
          <TextInput label="닉네임" value={nickname} setValue={setNickname} />
        ) : null}
        <TextInput label="이메일" value={email} setValue={setEmail} type="email" />
        <TextInput
          label="비밀번호"
          value={password}
          setValue={setPassword}
          type="password"
          minLength={7}
        />
        {mode === "login" ? (
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-xs font-semibold text-muted">
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(event) => setRememberEmail(event.target.checked)}
              className="size-3.5 cursor-pointer accent-primary"
            />
            <span>이메일 기억</span>
          </label>
        ) : null}
        <Button
          type="submit"
          fullWidth
          size="md"
          loading={loading}
          leftIcon={mode === "register" ? <UserPlus /> : <ShieldCheck />}
        >
          {mode === "register" ? "가입 요청" : "로그인"}
        </Button>
      </form>
    </>
  );
}
