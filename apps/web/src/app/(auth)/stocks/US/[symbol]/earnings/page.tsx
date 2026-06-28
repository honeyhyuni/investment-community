import { StockEarningsPage } from "@/domain/markets/components/StockEarningsPage";

export default async function UsStockEarningsRoute({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  return <StockEarningsPage symbol={symbol.trim().toUpperCase()} />;
}
