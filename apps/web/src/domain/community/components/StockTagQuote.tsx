"use client";

import { MarketQuote, TradeTick } from "@/common/types";
import { formatMoney, formatNumber } from "@/common/utils/format";
import { applyLiveTrade } from "@/common/utils/market";
import { usePreferencesStore } from "@/common/stores/preferences";
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
  const ko = usePreferencesStore((s) => s.language) === "ko";
  const displayCurrency = tag.market === "KR" ? "KRW" : "USD";
  const displayTag =
    tag.market === "KR" || /^\d{6}$/.test(tag.symbol)
      ? tag.name || tag.symbol
      : tag.symbol;
  const currentQuote = quote ? applyLiveTrade(quote, live) : null;
  const positive = (currentQuote?.change ?? 0) >= 0;

  return (
    <span className="group relative inline-flex items-center rounded-md border border-border-strong bg-surface-muted text-xs shadow-sm">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick?.(tag);
        }}
        className={`px-2.5 py-1.5 text-left ${
          onClick ? "cursor-pointer hover:bg-surface-muted" : "cursor-default"
        }`}
      >
        <span className="font-semibold text-primary">#{displayTag}</span>
        {currentQuote ? (
          <span className="ml-2 text-muted">
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
          className="border-l border-border px-2 py-1.5 font-semibold text-muted hover:bg-surface-muted"
          title={ko ? `${tag.symbol} 제거` : `Remove ${tag.symbol}`}
        >
          x
        </button>
      ) : null}
      {currentQuote ? (
        <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-56 rounded-md border border-border bg-surface p-3 text-left shadow-lg group-hover:block">
          <span className="block text-sm font-semibold text-foreground">
            {tag.name || currentQuote.name || tag.symbol}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {tag.symbol} · {tag.market}
          </span>
          <span className="mt-2 block text-base font-semibold text-foreground">
            {formatMoney(
              currentQuote.current,
              displayCurrency,
              currentQuote.currency,
              exchangeRate,
            )}
          </span>
          <span
            className={`mt-0.5 block text-xs font-semibold ${
              positive ? "text-positive" : "text-negative"
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

