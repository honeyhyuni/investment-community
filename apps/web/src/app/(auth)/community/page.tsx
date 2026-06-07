import { Suspense } from "react";
import { SessionLoading } from "@/common/components/SessionLoading";
import { CommunityPage } from "@/domain/community/components/CommunityPage";

export default function Page() {
  return (
    <Suspense fallback={<SessionLoading />}>
      <CommunityPage />
    </Suspense>
  );
}
