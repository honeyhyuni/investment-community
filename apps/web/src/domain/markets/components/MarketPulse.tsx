"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/common/components/Button";
import { DisplayCurrency, MarketQuote, TradeTick } from "@/common/types";
import { formatMoney, formatNumber } from "@/common/utils/format";
import { applyLiveTrade } from "@/common/utils/market";

export function MarketPulse({
  pulse,
  livePrices,
  loading,
  refresh,
  title = "Market pulse",
  eyebrow = "Live overview",
  refreshLabel = "Refresh",
  exchangeRate,
  exchangeRateErrorLabel = "Exchange rate unavailable",
}: {
  pulse: MarketQuote[];
  livePrices: Record<string, TradeTick>;
  loading: boolean;
  refresh: () => void;
  title?: string;
  eyebrow?: string;
  refreshLabel?: string;
  exchangeRate?: number | null;
  exchangeRateErrorLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHint = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      setCanScrollRight(false);
      return;
    }

    const remainingScroll =
      element.scrollWidth - element.clientWidth - element.scrollLeft;
    setCanScrollLeft(element.scrollLeft > 4);
    setCanScrollRight(remainingScroll > 4);
  }, []);

  useEffect(() => {
    updateScrollHint();
    window.addEventListener("resize", updateScrollHint);
    return () => window.removeEventListener("resize", updateScrollHint);
  }, [pulse.length, updateScrollHint]);

  return (
    <section className="-mx-4 mt-4 border-y border-border bg-surface p-3 shadow-sm sm:mx-0 sm:mt-5 sm:rounded-lg sm:border sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">
            {title}
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          loading={loading}
          className="shrink-0"
        >
          {refreshLabel}
        </Button>
      </div>
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={updateScrollHint}
          className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 md:mx-0 md:grid md:grid-cols-4 md:px-0"
        >
          {pulse.map((item) => {
            const live = livePrices[item.symbol];
            return (
              <PulseCard
                key={item.symbol}
                quote={applyLiveTrade(item, live)}
                live={!!live}
                exchangeRate={exchangeRate}
                exchangeRateErrorLabel={exchangeRateErrorLabel}
              />
            );
          })}
        </div>
        <div
          className={`pointer-events-none absolute inset-y-0 -left-3 w-10 bg-gradient-to-r from-surface via-surface/90 to-transparent backdrop-blur-[1px] transition-opacity duration-200 md:hidden ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute inset-y-0 -right-3 w-10 bg-gradient-to-l from-surface via-surface/90 to-transparent backdrop-blur-[1px] transition-opacity duration-200 md:hidden ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
      </div>
    </section>
  );
}

function PulseCard({
  quote,
  live = false,
  displayCurrency = "USD",
  exchangeRate,
  exchangeRateErrorLabel,
}: {
  quote: MarketQuote;
  live?: boolean;
  displayCurrency?: DisplayCurrency;
  exchangeRate?: number | null;
  exchangeRateErrorLabel: string;
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
    <div className="relative min-w-[184px] overflow-hidden rounded-md border border-border bg-surface p-4 shadow-sm transition-colors hover:border-border-strong md:min-w-0">
      <span
        className={`absolute inset-x-0 top-0 h-1 ${
          positive ? "bg-positive" : "bg-negative"
        }`}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground md:text-base">
            {quote.name || quote.symbol}
          </p>
        </div>
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-md ${
            positive
              ? "bg-positive-surface text-positive"
              : "bg-negative-surface text-negative"
          }`}
        >
          {positive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
        </span>
      </div>
      <p className="mt-3 truncate font-mono text-xl font-semibold tabular-nums text-foreground md:text-2xl">
        {currentText}
      </p>
      {isExchangeRate && quote.current <= 0 ? (
        <p className="mt-1 text-sm font-medium text-muted">
          {exchangeRateErrorLabel}
        </p>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p
            className={`truncate font-mono text-xs font-semibold tabular-nums md:text-sm ${
              positive ? "text-positive" : "text-negative"
            }`}
          >
            {positive ? "+" : ""}
            {changeText} ({positive ? "+" : ""}
            {formatNumber(quote.percentChange)}%)
          </p>
          {live ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              Live
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
