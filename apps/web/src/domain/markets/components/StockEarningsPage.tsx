"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { Skeleton } from "@/common/components/Skeleton";
import { apiRequest } from "@/common/lib/api";
import { useMarketDataStore } from "@/common/stores/market-data";
import { usePreferencesStore } from "@/common/stores/preferences";
import { useSessionStore } from "@/common/stores/session";
import { DisplayCurrency } from "@/common/types";
import { convertMoneyValue } from "@/common/utils/format";
import { UsEarningsCalendarItem } from "@/domain/ipo/types";
import {
  UsStockFinancial,
  UsStockFinancialResponse,
} from "@/domain/markets/types";

export function StockEarningsPage({ symbol }: { symbol: string }) {
  const accessToken = useSessionStore((state) => state.accessToken);
  const language = usePreferencesStore((state) => state.language);
  const exchangeRate = useMarketDataStore((state) => state.exchangeRate);
  const [rows, setRows] = useState<UsEarningsCalendarItem[]>([]);
  const [financialRows, setFinancialRows] = useState<UsStockFinancial[]>([]);
  const [displayCurrency, setDisplayCurrency] =
    useState<DisplayCurrency>("USD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ko = language === "ko";

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      apiRequest<UsEarningsCalendarItem[]>(
        "/markets/stocks/earnings/us?symbol=" + encodeURIComponent(symbol),
        "GET",
        { accessToken },
      ),
      apiRequest<UsStockFinancialResponse>(
        "/markets/stocks/financials/us?symbol=" + encodeURIComponent(symbol),
        "GET",
        { accessToken },
      ).catch(() => null),
    ])
      .then(([response, financials]) => {
        if (!cancelled) {
          setRows(response);
          setFinancialRows(financials?.quarterly ?? []);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load earnings events.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, symbol]);

  const latest = useMemo(() => rows[0] ?? null, [rows]);

  return (
    <section className="space-y-5 pt-3 sm:pt-1">
      <div>
        <Link
          href={
            "/?market=US&symbol=" +
            encodeURIComponent(symbol) +
            "&currency=" +
            displayCurrency
          }
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <ChevronLeft size={16} />
          {ko ? "종목 상세로 돌아가기" : "Back to stock"}
        </Link>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {symbol} {ko ? "실적 발표" : "Earnings"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {ko
                ? "예상치는 Alpha Vantage/Finnhub, 발표 직후 actual은 Finnhub, 확정 재무제표는 SEC 기준입니다."
                : "Estimates come from Alpha Vantage/Finnhub, preliminary actuals from Finnhub, and confirmed statements from SEC."}
            </p>
          </div>
          <div className="inline-flex self-start rounded-lg border border-border bg-surface-muted p-0.5 shadow-sm">
            {(["USD", "KRW"] as const).map((currency) => (
              <button
                key={currency}
                type="button"
                onClick={() => setDisplayCurrency(currency)}
                className={
                  "min-h-8 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors " +
                  (displayCurrency === currency
                    ? "bg-primary text-on-primary"
                    : "text-muted hover:text-foreground")
                }
              >
                {currency === "KRW" ? "원" : "$"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Notice message="" error={error} />
      {loading ? <EarningsSkeleton /> : null}

      {!loading && !rows.length && !error ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted">
          {ko
            ? "표시할 S&P500 실적 이벤트가 없습니다."
            : "No S&P 500 earnings events to show."}
        </div>
      ) : null}

      {!loading && latest ? (
        <EarningsEventCard
          item={latest}
          financialRows={financialRows}
          ko={ko}
          displayCurrency={displayCurrency}
          exchangeRate={exchangeRate}
          featured
        />
      ) : null}

      {!loading && rows.length > 1 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {ko ? "최근/예정 실적" : "Recent and upcoming earnings"}
          </h2>
          {rows.slice(1).map((item) => (
            <EarningsEventCard
              key={item.id}
              item={item}
              financialRows={financialRows}
              ko={ko}
              displayCurrency={displayCurrency}
              exchangeRate={exchangeRate}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EarningsEventCard({
  item,
  financialRows,
  ko,
  displayCurrency,
  exchangeRate,
  featured = false,
}: {
  item: UsEarningsCalendarItem;
  financialRows: UsStockFinancial[];
  ko: boolean;
  displayCurrency: DisplayCurrency;
  exchangeRate: number | null;
  featured?: boolean;
}) {
  const hasActual = item.epsActual !== null || item.revenueActual !== null;
  const status = item.secConfirmedAt
    ? ko
      ? "SEC 공시 확정"
      : "SEC confirmed"
    : hasActual
      ? ko
        ? "발표치"
        : "Preliminary actual"
      : ko
        ? "예상"
        : "Estimate";
  const comparisons = buildHistoricalComparisons(item, financialRows);

  return (
    <div
      className={
        "rounded-md border border-border bg-surface p-4 " +
        (featured ? "sm:p-5" : "")
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-primary">{status}</p>
          <h2
            className={
              featured
                ? "mt-1 text-xl font-bold"
                : "mt-1 text-base font-semibold"
            }
          >
            {earningsPeriodLabel(item)}{" "}
            {hasActual || item.secConfirmedAt ? "" : "(E)"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {item.reportDate} · {formatEarningsHour(item.timeOfTheDay, ko)}
          </p>
        </div>
        <p className="text-xs text-muted">
          {ko ? "출처" : "Source"}:{" "}
          {item.actualSource || item.estimateSource || item.source}
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <CompareBox
          label={ko ? "매출" : "Revenue"}
          actual={item.revenueActual}
          estimate={item.revenueEstimate}
          displayCurrency={displayCurrency}
          exchangeRate={exchangeRate}
          perShare={false}
          ko={ko}
        />
        <CompareBox
          label="EPS"
          actual={item.epsActual}
          estimate={item.estimate}
          displayCurrency={displayCurrency}
          exchangeRate={exchangeRate}
          perShare
          ko={ko}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <HistoryCompareBox
          label={ko ? "\uB9E4\uCD9C \uC131\uC7A5" : "Revenue growth"}
          qoq={comparisons.revenueQoq}
          yoy={comparisons.revenueYoy}
          previousValue={comparisons.previousRevenue}
          yearAgoValue={comparisons.yearAgoRevenue}
          displayCurrency={displayCurrency}
          exchangeRate={exchangeRate}
          perShare={false}
          ko={ko}
        />
        <HistoryCompareBox
          label={ko ? "EPS \uC131\uC7A5" : "EPS growth"}
          qoq={comparisons.epsQoq}
          yoy={comparisons.epsYoy}
          previousValue={comparisons.previousEps}
          yearAgoValue={comparisons.yearAgoEps}
          displayCurrency={displayCurrency}
          exchangeRate={exchangeRate}
          perShare
          ko={ko}
        />
      </div>
    </div>
  );
}

function CompareBox({
  label,
  actual,
  estimate,
  displayCurrency,
  exchangeRate,
  perShare,
  ko,
}: {
  label: string;
  actual: number | null;
  estimate: number | null;
  displayCurrency: DisplayCurrency;
  exchangeRate: number | null;
  perShare: boolean;
  ko: boolean;
}) {
  const surprise =
    actual !== null && estimate !== null && estimate !== 0
      ? ((actual - estimate) / Math.abs(estimate)) * 100
      : null;
  return (
    <div className="rounded-md bg-surface-muted p-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <div className="mt-2 space-y-1 text-sm">
        <p className="font-semibold text-foreground">
          {ko ? "실제" : "Actual"}:{" "}
          {formatEarningsMoney(actual, displayCurrency, exchangeRate, perShare)}
        </p>
        <p className="text-muted">
          {ko ? "예상" : "Estimate"}:{" "}
          {formatEarningsMoney(
            estimate,
            displayCurrency,
            exchangeRate,
            perShare,
          )}
        </p>
        <p
          className={
            surprise === null
              ? "text-muted"
              : surprise >= 0
                ? "text-positive"
                : "text-negative"
          }
        >
          {ko ? "예상 대비" : "Surprise"}: {formatPercentChange(surprise)}
        </p>
      </div>
    </div>
  );
}

function HistoryCompareBox({
  label,
  qoq,
  yoy,
  previousValue,
  yearAgoValue,
  displayCurrency,
  exchangeRate,
  perShare,
  ko,
}: {
  label: string;
  qoq: number | null;
  yoy: number | null;
  previousValue: number | null;
  yearAgoValue: number | null;
  displayCurrency: DisplayCurrency;
  exchangeRate: number | null;
  perShare: boolean;
  ko: boolean;
}) {
  return (
    <div className="rounded-md bg-surface-muted p-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <div className="mt-2 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">
            {ko ? "\uC804\uBD84\uAE30" : "Previous quarter"}
          </span>
          <span className="font-medium text-foreground">
            {formatEarningsMoney(
              previousValue,
              displayCurrency,
              exchangeRate,
              perShare,
            )}
          </span>
          <span className={changeClass(qoq)}>{formatPercentChange(qoq)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">
            {ko ? "\uC804\uB144\uB3D9\uAE30" : "Year ago"}
          </span>
          <span className="font-medium text-foreground">
            {formatEarningsMoney(
              yearAgoValue,
              displayCurrency,
              exchangeRate,
              perShare,
            )}
          </span>
          <span className={changeClass(yoy)}>{formatPercentChange(yoy)}</span>
        </div>
      </div>
    </div>
  );
}

function EarningsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function buildHistoricalComparisons(
  item: UsEarningsCalendarItem,
  financialRows: UsStockFinancial[],
) {
  const byLabel = new Map<string, UsStockFinancial>();
  [...financialRows]
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))
    .forEach((row) => byLabel.set(financialPeriodLabel(row), row));

  const label = earningsPeriodLabel(item);
  const current = parsePeriodLabel(label);
  const secCurrent = byLabel.get(label);
  const revenue = item.revenueActual ?? secCurrent?.revenue ?? null;
  const eps = item.epsActual ?? secCurrent?.eps ?? null;
  const previous = current
    ? byLabel.get(periodLabelFromOffset(current.year, current.quarter, -1))
    : undefined;
  const yearAgo = current
    ? byLabel.get(periodLabelFromOffset(current.year, current.quarter, -4))
    : undefined;

  return {
    previousRevenue: previous?.revenue ?? null,
    yearAgoRevenue: yearAgo?.revenue ?? null,
    previousEps: previous?.eps ?? null,
    yearAgoEps: yearAgo?.eps ?? null,
    revenueQoq: percentChange(revenue, previous?.revenue ?? null),
    revenueYoy: percentChange(revenue, yearAgo?.revenue ?? null),
    epsQoq: percentChange(eps, previous?.eps ?? null),
    epsYoy: percentChange(eps, yearAgo?.eps ?? null),
  };
}

function earningsPeriodLabel(item: UsEarningsCalendarItem) {
  const baseDate = item.fiscalDateEnding || item.reportDate;
  const date = new Date(baseDate.slice(0, 10) + "T00:00:00Z");
  if (!Number.isNaN(date.getTime())) {
    date.setUTCMonth(date.getUTCMonth() - 1);
    return (
      date.getUTCFullYear() + " Q" + (Math.floor(date.getUTCMonth() / 3) + 1)
    );
  }
  return item.reportDate.slice(0, 7);
}

function financialPeriodLabel(row: UsStockFinancial) {
  const end = new Date(row.periodEnd.slice(0, 10) + "T00:00:00Z");
  const start = row.periodStart
    ? new Date(row.periodStart.slice(0, 10) + "T00:00:00Z")
    : null;
  const middle =
    start && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
      ? new Date((start.getTime() + end.getTime()) / 2)
      : end;
  if (Number.isNaN(middle.getTime())) {
    return row.fiscalYear + " Q" + row.fiscalQuarter;
  }
  return (
    middle.getUTCFullYear() + " Q" + (Math.floor(middle.getUTCMonth() / 3) + 1)
  );
}

function parsePeriodLabel(label: string) {
  const match = /^(\d{4}) Q([1-4])$/.exec(label);
  return match ? { year: Number(match[1]), quarter: Number(match[2]) } : null;
}

function periodLabelFromOffset(year: number, quarter: number, offset: number) {
  const zeroBased = year * 4 + (quarter - 1) + offset;
  const nextYear = Math.floor(zeroBased / 4);
  const nextQuarter = (zeroBased % 4) + 1;
  return nextYear + " Q" + nextQuarter;
}

function percentChange(current: number | null, base: number | null) {
  if (current === null || base === null || base === 0) return null;
  return ((current - base) / Math.abs(base)) * 100;
}

function formatPercentChange(value: number | null) {
  return value === null
    ? "-"
    : (value >= 0 ? "+" : "") + value.toFixed(2) + "%";
}

function changeClass(value: number | null) {
  return value === null
    ? "text-muted"
    : value >= 0
      ? "text-positive"
      : "text-negative";
}

function formatEarningsHour(value: string | null, ko: boolean) {
  const normalized = value?.toLowerCase();
  if (normalized === "bmo") return ko ? "장전" : "Before market";
  if (normalized === "amc") return ko ? "장후" : "After market";
  return ko ? "시간 미정" : "Time unknown";
}

function formatEarningsMoney(
  value: number | null,
  displayCurrency: DisplayCurrency,
  exchangeRate: number | null,
  perShare: boolean,
) {
  if (value === null || !Number.isFinite(value)) return "-";
  const converted = convertMoneyValue(
    value,
    displayCurrency,
    "USD",
    exchangeRate,
  );
  if (!Number.isFinite(converted)) return "-";
  const sign = converted < 0 ? "-" : "";
  const absolute = Math.abs(converted);
  if (perShare) {
    return displayCurrency === "KRW"
      ? sign +
          new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(
            absolute,
          ) +
          "원"
      : sign +
          "$" +
          new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
            absolute,
          );
  }
  if (displayCurrency === "KRW") {
    if (absolute >= 1e12) return sign + compact(absolute / 1e12) + "조";
    if (absolute >= 1e8) return sign + compact(absolute / 1e8) + "억";
    return (
      sign +
      new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(
        absolute,
      ) +
      "원"
    );
  }
  if (absolute >= 1e12) return sign + "$" + compact(absolute / 1e12) + "T";
  if (absolute >= 1e9) return sign + "$" + compact(absolute / 1e9) + "B";
  if (absolute >= 1e6) return sign + "$" + compact(absolute / 1e6) + "M";
  return sign + "$" + compact(absolute);
}

function compact(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    value,
  );
}
