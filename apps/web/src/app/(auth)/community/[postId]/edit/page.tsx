import { Suspense } from "react";
import { SessionLoading } from "@/common/components/SessionLoading";
import { PostEditorPage } from "@/domain/community/components/PostEditorPage";

export default async function Page({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  return (
    <Suspense fallback={<SessionLoading />}>
      <PostEditorPage postId={postId} />
    </Suspense>
  );
}
