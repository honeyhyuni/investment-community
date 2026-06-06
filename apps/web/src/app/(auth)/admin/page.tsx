"use client";

import { Suspense } from "react";
import { SessionLoading } from "@/common/components/SessionLoading";
import { AdminPage } from "@/domain/admin/components/AdminPage";

export default function AdminRoute() {
  return (
    <Suspense fallback={<SessionLoading />}>
      <AdminPage />
    </Suspense>
  );
}
