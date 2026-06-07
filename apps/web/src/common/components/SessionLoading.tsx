import { Loader2 } from "lucide-react";

export function SessionLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex items-center gap-3 rounded-lg border border-[#d9dee8] bg-white px-4 py-3 text-sm text-[#607086] shadow-sm">
        <Loader2 size={18} className="animate-spin" />
        Checking session
      </div>
    </div>
  );
}
