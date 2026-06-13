import { Suspense } from "react";
import { SessionLoading } from "@/common/components/SessionLoading";
import { PostEditorPage } from "@/domain/community/components/PostEditorPage";

export default function Page() {
  return (
    <Suspense fallback={<SessionLoading />}>
      <PostEditorPage />
    </Suspense>
  );
}
