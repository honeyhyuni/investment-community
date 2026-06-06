"use client";

import { Suspense } from "react";
import { SessionLoading } from "@/common/components/SessionLoading";
import { NewsPage } from "@/domain/news/components/NewsPage";

export default function NewsRoute() {
  return (
    <Suspense fallback={<SessionLoading />}>
      <NewsPage />
    </Suspense>
  );
}
