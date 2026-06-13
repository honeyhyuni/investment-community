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
      <div className="mt-5 grid grid-cols-2 rounded-md border border-border bg-surface-muted p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`h-9 cursor-pointer rounded-md px-3 text-sm font-semibold transition-colors ${
            mode === "login"
              ? "bg-surface text-primary shadow-sm"
              : "text-muted hover:text-primary"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`h-9 cursor-pointer rounded-md px-3 text-sm font-semibold transition-colors ${
            mode === "register"
              ? "bg-surface text-primary shadow-sm"
              : "text-muted hover:text-primary"
          }`}
        >
          Request
        </button>
      </div>

      <form onSubmit={submitAuth} className="mt-5 space-y-4">
        <TextInput label="Email" value={email} setValue={setEmail} type="email" />
        {mode === "login" ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(event) => setRememberEmail(event.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            email 기억
          </label>
        ) : null}
        {mode === "register" ? (
          <TextInput label="Nickname" value={nickname} setValue={setNickname} />
        ) : null}
        <TextInput
          label="Password"
          value={password}
          setValue={setPassword}
          type="password"
          minLength={8}
        />
        <Button
          type="submit"
          fullWidth
          loading={loading}
          leftIcon={mode === "register" ? <UserPlus /> : <ShieldCheck />}
        >
          {mode === "register" ? "Request access" : "Sign in"}
        </Button>
      </form>
    </>
  );
}
