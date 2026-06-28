import { MarketBriefingPage } from "@/domain/market-briefing/components/MarketBriefingPage";

export default async function MarketBriefingDetailRoute({
  params,
}: {
  params: Promise<{ briefingId: string }>;
}) {
  const { briefingId } = await params;
  return <MarketBriefingPage briefingId={briefingId} />;
}
