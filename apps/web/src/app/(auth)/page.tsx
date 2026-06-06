"use client";

import { Suspense } from "react";
import { SessionLoading } from "@/common/components/SessionLoading";
import { StocksPage } from "@/domain/markets/components/StocksPage";

export default function Page() {
  return (
    <Suspense fallback={<SessionLoading />}>
      <StocksPage />
    </Suspense>
  );
}
