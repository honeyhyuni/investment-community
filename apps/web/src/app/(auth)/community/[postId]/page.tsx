import { Suspense } from "react";
import { SessionLoading } from "@/common/components/SessionLoading";
import { CommunityPage } from "@/domain/community/components/CommunityPage";

export default async function Page({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  return (
    <Suspense fallback={<SessionLoading />}>
      <CommunityPage postId={postId} />
    </Suspense>
  );
}
