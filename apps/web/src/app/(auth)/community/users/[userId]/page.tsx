import { CommunityPage } from "@/domain/community/components/CommunityPage";

export default async function CommunityUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <CommunityPage userId={userId} />;
}
