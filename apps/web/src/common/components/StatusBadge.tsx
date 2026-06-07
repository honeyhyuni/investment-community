import { UserStatus } from "@/common/lib/api";

export const statusLabel: Record<UserStatus, string> = {
  APPROVED: "Approved",
  PENDING: "Pending",
  REJECTED: "Rejected",
};

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className="rounded-md bg-[#edf3ee] px-2.5 py-1 text-xs font-semibold text-[#27613a]">
      {statusLabel[status]}
    </span>
  );
}
