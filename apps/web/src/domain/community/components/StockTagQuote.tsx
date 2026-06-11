"use client";

import { MarketQuote, TradeTick } from "@/common/types";
import { formatMoney, formatNumber } from "@/common/utils/format";
import { applyLiveTrade } from "@/common/utils/market";
import { StockTag } from "@/domain/community/types";

type StockTagQuoteProps = {
  tag: StockTag;
  quote: MarketQuote | null;
  live?: TradeTick;
  onClick?: (tag: StockTag) => void;
  onRemove?: (tag: StockTag) => void;
  exchangeRate?: number | null;
};

export function StockTagQuote({
  tag,
  quote,
  live,
  onClick,
  onRemove,
  exchangeRate,
}: StockTagQuoteProps) {
  const displayCurrency = tag.market === "KR" ? "KRW" : "USD";
  const currentQuote = quote ? applyLiveTrade(quote, live) : null;
  const positive = (currentQuote?.change ?? 0) >= 0;

  return (
    <span className="group relative inline-flex items-center rounded-md border border-[#c7ceda] bg-[#f9fafc] text-xs shadow-sm">
      <button
        type="button"
        onClick={() => onClick?.(tag)}
        className={`px-2.5 py-1.5 text-left ${
          onClick ? "cursor-pointer hover:bg-[#eef6f9]" : "cursor-default"
        }`}
      >
        <span className="font-semibold text-[#1f6f8b]">#{tag.symbol}</span>
        {currentQuote ? (
          <span className="ml-2 text-[#607086]">
            {formatMoney(
              currentQuote.current,
              displayCurrency,
              currentQuote.currency,
              exchangeRate,
            )}
          </span>
        ) : null}
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(tag)}
          className="border-l border-[#d9dee8] px-2 py-1.5 font-semibold text-[#607086] hover:bg-[#eef1f6]"
          title={`${tag.symbol} 제거`}
        >
          x
        </button>
      ) : null}
      {currentQuote ? (
        <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-56 rounded-md border border-[#d9dee8] bg-white p-3 text-left shadow-lg group-hover:block">
          <span className="block text-sm font-semibold text-[#161a22]">
            {tag.name || currentQuote.name || tag.symbol}
          </span>
          <span className="mt-0.5 block text-xs text-[#607086]">
            {tag.symbol} · {tag.market}
          </span>
          <span className="mt-2 block text-base font-semibold text-[#161a22]">
            {formatMoney(
              currentQuote.current,
              displayCurrency,
              currentQuote.currency,
              exchangeRate,
            )}
          </span>
          <span
            className={`mt-0.5 block text-xs font-semibold ${
              positive ? "text-[#2e7d4f]" : "text-[#b64242]"
            }`}
          >
            {positive ? "+" : ""}
            {formatMoney(
              currentQuote.change,
              displayCurrency,
              currentQuote.currency,
              exchangeRate,
            )} (
            {positive ? "+" : ""}
            {formatNumber(currentQuote.percentChange)}%)
          </span>
        </span>
      ) : null}
    </span>
  );
}

