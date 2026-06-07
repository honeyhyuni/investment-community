import { Clock } from "lucide-react";
import { User } from "@/common/lib/api";

export function PendingPanel({ user }: { user: User | null }) {
  return (
    <section className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-lg border border-[#d9dee8] bg-white p-5 text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#fff6df] text-[#9b6500]">
        <Clock size={24} />
      </div>
      <h2 className="mt-4 text-xl font-semibold">
        {user?.status === "PENDING" ? "Approval pending" : "Private access"}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#607086]">
        {user?.status === "PENDING"
          ? "An admin needs to approve your account before you can enter."
          : "Only approved accounts can enter this community."}
      </p>
    </section>
  );
}
