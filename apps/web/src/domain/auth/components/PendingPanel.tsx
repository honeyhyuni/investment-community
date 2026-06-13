import { Clock, ShieldCheck, TrendingUp } from "lucide-react";
import { User } from "@/common/lib/api";

export function PendingPanel({ user }: { user: User | null }) {
  const pending = user?.status === "PENDING";

  return (
    <section className="relative flex h-full min-h-[360px] flex-col justify-between overflow-hidden rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
      <span
        className="absolute inset-x-0 top-0 h-1 bg-[image:var(--brand-gradient)]"
        aria-hidden
      />
      <div>
        <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
          {pending ? <Clock size={24} /> : <ShieldCheck size={24} />}
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          {pending ? "Approval pending" : "Private access"}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
          {pending
            ? "An admin needs to approve your account before you can enter."
            : "Only approved accounts can enter this community."}
        </p>
      </div>
      <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
        <div className="rounded-md border border-border bg-surface-muted p-4">
          <TrendingUp size={18} className="text-positive" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Market-focused
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Track pulse, briefings, and stock conversations in one place.
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface-muted p-4">
          <ShieldCheck size={18} className="text-primary" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Member-only
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Access is reviewed so the community stays focused and quiet.
          </p>
        </div>
      </div>
    </section>
  );
}
