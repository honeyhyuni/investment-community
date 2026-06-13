import Image from "next/image";
import { Loader2 } from "lucide-react";

export function SessionLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-muted shadow-sm">
        <Image
          src="/icons/icon.svg"
          width={28}
          height={28}
          alt="15F"
          className="size-7 rounded-md"
          priority
        />
        <Loader2 size={18} className="animate-spin text-primary" />
        <span>Checking session</span>
      </div>
    </div>
  );
}
