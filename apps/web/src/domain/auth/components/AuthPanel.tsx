import { FormEvent } from "react";
import Image from "next/image";
import { Clock, ShieldCheck, Sparkles } from "lucide-react";
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
  const pending = props.user?.status === "PENDING";

  return (
    <section className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-surface shadow-xl shadow-slate-900/5 lg:justify-self-end">
      <div className="h-1 bg-[image:var(--brand-gradient)]" aria-hidden />
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <Image
            src="/icons/icon.svg"
            width={40}
            height={40}
            alt="15F"
            className="size-10 shrink-0 rounded-lg shadow-sm"
            priority
          />
          <div className="min-w-0 leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Portfolio Demo
            </p>
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              15F
            </h1>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              Member Access
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {props.heading}
            </h2>
            <p className="mt-1.5 text-sm leading-5 text-muted">
              {pending
                ? "가입 요청이 접수되었습니다. 관리자 승인 후 이용할 수 있습니다."
                : "승인된 계정으로 15F 서비스를 체험할 수 있습니다."}
            </p>
          </div>
          <div className="shrink-0">
            {props.user?.status ? (
              <StatusBadge status={props.user.status} />
            ) : (
              <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                <ShieldCheck size={20} />
              </span>
            )}
          </div>
        </div>

        <AuthForm {...props} />
        <Notice message={props.message} error={props.error} />

        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-muted text-primary">
              {pending ? <Clock size={18} /> : <Sparkles size={18} />}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {pending ? "승인 대기 중" : "읽기 전용 테스트 계정 제공"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {pending
                  ? "관리자가 승인한 뒤 로그인할 수 있습니다."
                  : "포트폴리오 확인용 테스트 계정은 피드에서 게시글/댓글 작성 등 변경 작업이 제한됩니다."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
