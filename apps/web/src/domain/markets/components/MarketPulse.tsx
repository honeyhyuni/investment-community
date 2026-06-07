"use client";

import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { DisplayCurrency, MarketQuote, TradeTick } from "@/common/types";
import { formatMoney, formatNumber } from "@/common/utils/format";

export function MarketPulse({
  pulse,
  livePrices,
  loading,
  refresh,
  title = "Market pulse",
  refreshLabel = "Refresh",
  exchangeRate,
}: {
  pulse: MarketQuote[];
  livePrices: Record<string, TradeTick>;
  loading: boolean;
  refresh: () => void;
  title?: string;
  refreshLabel?: string;
  exchangeRate?: number | null;
}) {
  return (
    <section className="mt-5 rounded-lg border border-[#d9dee8] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#344052]">{title}</h2>
        <button
          onClick={refresh}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-[#c7ceda] px-2.5 text-xs font-medium hover:bg-[#eef1f6]"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {refreshLabel}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {pulse.map((item) => {
          const live = livePrices[item.symbol];
          const current = live?.price ?? item.current;
          return (
            <PulseCard
              key={item.symbol}
              quote={{ ...item, current }}
              live={!!live}
              exchangeRate={exchangeRate}
            />
          );
        })}
      </div>
    </section>
  );
}

function PulseCard({
  quote,
  live = false,
  displayCurrency = "USD",
  exchangeRate,
}: {
  quote: MarketQuote;
  live?: boolean;
  displayCurrency?: DisplayCurrency;
  exchangeRate?: number | null;
}) {
  const positive = quote.change >= 0;
  const isIndex = quote.symbol.startsWith("KIS_INDEX:");
  const isExchangeRate = quote.symbol === "KIS_FX:USDKRW";
  const currentText = isIndex
    ? formatNumber(quote.current)
    : isExchangeRate
      ? `${formatNumber(quote.current)}원`
      : formatMoney(quote.current, displayCurrency, quote.currency, exchangeRate);
  const changeText = isIndex
    ? formatNumber(quote.change)
    : isExchangeRate
      ? `${formatNumber(quote.change)}원`
      : formatMoney(quote.change, displayCurrency, quote.currency, exchangeRate);

  return (
    <div className="rounded-md border border-[#d9dee8] bg-[#f9fafc] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{quote.name || quote.symbol}</p>
          <p className="text-xs text-[#607086]">{quote.symbol}</p>
        </div>
        {positive ? (
          <TrendingUp size={18} className="text-[#2e7d4f]" />
        ) : (
          <TrendingDown size={18} className="text-[#b64242]" />
        )}
      </div>
      <p className="mt-2 text-xl font-semibold">{currentText}</p>
      {isExchangeRate && quote.current <= 0 ? (
        <p className="mt-1 text-sm font-medium text-[#607086]">
          KIS 환율 조회 실패
        </p>
      ) : (
        <p className={`mt-1 text-sm font-medium ${positive ? "text-[#2e7d4f]" : "text-[#b64242]"}`}>
          {positive ? "+" : ""}
          {changeText} ({positive ? "+" : ""}
          {formatNumber(quote.percentChange)}%)
        </p>
      )}
      {live ? <p className="mt-2 text-xs font-medium text-[#1f6f8b]">Live tick</p> : null}
    </div>
  );
}

