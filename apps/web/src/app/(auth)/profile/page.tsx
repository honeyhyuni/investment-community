"use client";

import { Suspense } from "react";
import { SessionLoading } from "@/common/components/SessionLoading";
import { ProfilePage } from "@/domain/profile/components/ProfilePage";

export default function ProfileRoute() {
  return (
    <Suspense fallback={<SessionLoading />}>
      <ProfilePage />
    </Suspense>
  );
}
