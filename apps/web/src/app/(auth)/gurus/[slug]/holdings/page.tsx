import { GuruPortfoliosPage } from "@/domain/gurus/components/GuruPortfoliosPage";

export default async function GuruHoldingsRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <GuruPortfoliosPage slug={slug} initialTab="holdings" />;
}
