import { FormEvent } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { TextInput } from "@/common/components/TextInput";
import { AuthMode } from "@/domain/auth/types";

export function AuthForm({
  mode,
  setMode,
  email,
  setEmail,
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
  password: string;
  setPassword: (value: string) => void;
  nickname: string;
  setNickname: (value: string) => void;
  loading: boolean;
  submitAuth: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <>
      <div className="mt-5 grid grid-cols-2 rounded-md border border-[#d4dae5] bg-[#f3f5f9] p-1">
        <button
          onClick={() => setMode("login")}
          className={`h-9 rounded px-3 text-sm font-medium ${
            mode === "login"
              ? "bg-white text-[#151923] shadow-sm"
              : "text-[#607086]"
          }`}
        >
          Sign in
        </button>
        <button
          onClick={() => setMode("register")}
          className={`h-9 rounded px-3 text-sm font-medium ${
            mode === "register"
              ? "bg-white text-[#151923] shadow-sm"
              : "text-[#607086]"
          }`}
        >
          Request
        </button>
      </div>

      <form onSubmit={submitAuth} className="mt-5 space-y-4">
        <TextInput label="Email" value={email} setValue={setEmail} type="email" />
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
        <button
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1f6f8b] px-4 text-sm font-semibold text-white hover:bg-[#195b72] disabled:opacity-60"
        >
          {mode === "register" ? <UserPlus size={16} /> : <ShieldCheck size={16} />}
          {loading ? "Working" : mode === "register" ? "Request access" : "Sign in"}
        </button>
      </form>
    </>
  );
}
