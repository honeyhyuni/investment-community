import { FormEvent } from "react";
import { User } from "@/lib/api";
import { Notice } from "@/common/components/Notice";
import { StatusBadge } from "@/common/components/StatusBadge";
import { AuthForm } from "@/domain/auth/components/AuthForm";
import { AuthMode } from "@/domain/auth/types";

export function AuthPanel(props: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  email: string;
  setEmail: (value: string) => void;
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
    <section className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{props.heading}</h2>
        {props.user?.status ? (
          <StatusBadge status={props.user.status} />
        ) : null}
      </div>
      <AuthForm {...props} />
      <Notice message={props.message} error={props.error} />
    </section>
  );
}
