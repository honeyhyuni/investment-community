import { StockFinancialsPage } from "@/domain/markets/components/StockFinancialsPage";

export default async function UsStockFinancialsRoute({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  return <StockFinancialsPage symbol={symbol.trim().toUpperCase()} />;
}
