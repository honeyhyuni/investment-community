"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MarketQuote, TradeTick } from "@/common/types";
import { formatMoney, formatNumber } from "@/common/utils/format";
import { applyLiveTrade } from "@/common/utils/market";
import { useMarketDataStore } from "@/common/stores/market-data";
import { usePreferencesStore } from "@/common/stores/preferences";
import { useSessionStore } from "@/common/stores/session";
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
  const accessToken = useSessionStore((s) => s.accessToken);
  const loadStockQuotes = useMarketDataStore((s) => s.loadStockQuotes);
  const displayCurrency = tag.market === "KR" ? "KRW" : "USD";
  const displayTag =
    tag.market === "KR" || /^\d{6}$/.test(tag.symbol)
      ? tag.name || tag.symbol
      : tag.symbol;
  const currentQuote = quote ? applyLiveTrade(quote, live) : null;
  const positive = (currentQuote?.change ?? 0) >= 0;
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const isTouchLike = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: none), (pointer: coarse)").matches,
    [],
  );

  const requestQuote = () => {
    if (!accessToken || requested || currentQuote) {
      return;
    }
    setRequested(true);
    void loadStockQuotes([{ symbol: tag.symbol, market: tag.market }], accessToken);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="group relative inline-flex items-center rounded-md border border-border-strong bg-surface-muted text-xs shadow-sm"
      onPointerEnter={() => {
        if (!isTouchLike) {
          requestQuote();
        }
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          requestQuote();
          if (isTouchLike) {
            setOpen((current) => !current);
            return;
          }
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
          className="cursor-pointer border-l border-border px-2 py-1.5 font-semibold text-muted hover:bg-surface-muted"
          title={ko ? `${tag.symbol} 제거` : `Remove ${tag.symbol}`}
        >
          x
        </button>
      ) : null}
      {currentQuote || open ? (
        <span
          className={`absolute bottom-full left-0 z-30 mb-2 w-56 rounded-md border border-border bg-surface p-3 text-left shadow-lg ${
            open ? "block" : "pointer-events-none hidden group-hover:block"
          }`}
        >
          <span className="block text-sm font-semibold text-foreground">
            {tag.name || currentQuote?.name || tag.symbol}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {tag.symbol} / {tag.market}
          </span>
          {currentQuote ? (
            <>
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
            </>
          ) : (
            <span className="mt-2 block text-xs font-semibold text-muted">
              {ko ? "시세 조회 중" : "Loading quote"}
            </span>
          )}
          {isTouchLike && onClick ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClick(tag);
              }}
              className="mt-3 h-8 w-full cursor-pointer rounded-md bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-strong"
            >
              {ko ? "종목 보기" : "View stock"}
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
