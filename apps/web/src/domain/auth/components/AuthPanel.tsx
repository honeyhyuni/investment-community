import { FormEvent } from "react";
import { User } from "@/common/lib/api";
import { Notice } from "@/common/components/Notice";
import { StatusBadge } from "@/common/components/StatusBadge";
import { AuthForm } from "@/domain/auth/components/AuthForm";
import { AuthMode } from "@/domain/auth/types";

export function AuthPanel(props: {
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
  heading: string;
  user: User | null;
  message: string;
  error: string;
  loading: boolean;
  submitAuth: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            15F Access
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {props.heading}
          </h2>
        </div>
        {props.user?.status ? (
          <StatusBadge status={props.user.status} />
        ) : null}
      </div>
      <AuthForm {...props} />
      <Notice message={props.message} error={props.error} />
    </section>
  );
}
