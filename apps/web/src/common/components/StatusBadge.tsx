import { UserStatus } from "@/common/lib/api";

export const statusLabel: Record<UserStatus, string> = {
  APPROVED: "Approved",
  PENDING: "Pending",
  REJECTED: "Rejected",
};

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
      {statusLabel[status]}
    </span>
  );
}
