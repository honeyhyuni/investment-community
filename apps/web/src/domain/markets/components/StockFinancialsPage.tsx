"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { Skeleton } from "@/common/components/Skeleton";
import { apiRequest } from "@/common/lib/api";
import { useSessionStore } from "@/common/stores/session";
import { usePreferencesStore } from "@/common/stores/preferences";
import { useMarketDataStore } from "@/common/stores/market-data";
import { DisplayCurrency } from "@/common/types";
import { convertMoneyValue } from "@/common/utils/format";
import {
  UsStockFinancial,
  UsStockFinancialResponse,
} from "@/domain/markets/types";

type PeriodTab = "ANNUAL" | "QUARTERLY";

export function StockFinancialsPage({ symbol }: { symbol: string }) {
  const accessToken = useSessionStore((state) => state.accessToken);
  const language = usePreferencesStore((state) => state.language);
  const exchangeRate = useMarketDataStore((state) => state.exchangeRate);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCurrency = searchParams.get("currency")?.trim().toUpperCase() === "KRW" ? "KRW" : "USD";
  const [data, setData] = useState<UsStockFinancialResponse | null>(null);
  const [tab, setTab] = useState<PeriodTab>("ANNUAL");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>(urlCurrency);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const ko = language === "ko";

  useEffect(() => {
    setDisplayCurrency(urlCurrency);
  }, [urlCurrency]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    apiRequest<UsStockFinancialResponse>(
      "/markets/stocks/financials/us?symbol=" + encodeURIComponent(symbol),
      "GET",
      { accessToken },
    )
      .then((response) => {
        if (!cancelled) {
          setData(response);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load financial statements.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, symbol]);

  const rows = useMemo(
    () => (tab === "ANNUAL" ? (data?.annual ?? []) : (data?.quarterly ?? [])),
    [data, tab],
  );

  function changeDisplayCurrency(nextCurrency: DisplayCurrency) {
    setDisplayCurrency(nextCurrency);
    const params = new URLSearchParams(searchParams.toString());
    params.set("currency", nextCurrency);
    router.replace("?" + params.toString(), { scroll: false });
  }

  return (
    <section className="space-y-5">
      <div>
        <Link
          href={"/?market=US&symbol=" + encodeURIComponent(symbol) + "&currency=" + displayCurrency}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <ChevronLeft size={16} />
          {ko ? "\uC885\uBAA9 \uC0C1\uC138\uB85C \uB3CC\uC544\uAC00\uAE30" : "Back to stock"}
        </Link>
        <p className="mt-4 text-sm text-muted">S&amp;P 500 ? SEC EDGAR</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {data?.companyName || symbol} ({symbol})
        </h1>
        <p className="mt-2 text-sm text-muted">
          {ko
            ? "SEC \uD655\uC815 \uACF5\uC2DC\uB97C \uCCAB \uC870\uD68C \uC2DC DB\uC5D0 \uC800\uC7A5\uD55C \uC2E4\uC81C \uC2E4\uC801\uC785\uB2C8\uB2E4."
            : "Actual results stored from SEC filings on first request."}
        </p>
      </div>

      <Notice message="" error={error} />
      {loading ? <FinancialSkeleton /> : null}

      {!loading && data ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex rounded-md border border-border bg-surface p-1">
              {(["ANNUAL", "QUARTERLY"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={"rounded px-4 py-2 text-sm font-semibold " +
                    (tab === value
                      ? "bg-primary text-on-primary"
                      : "text-muted hover:text-foreground")}
                >
                  {value === "ANNUAL"
                    ? ko
                      ? "\uC5F0\uAC04 \uC2E4\uC801"
                      : "Annual"
                    : ko
                      ? "\uBD84\uAE30 \uC2E4\uC801"
                      : "Quarterly"}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-md border border-border bg-surface p-1">
              {(["USD", "KRW"] as const).map((currency) => (
                <button
                  key={currency}
                  type="button"
                  onClick={() => changeDisplayCurrency(currency)}
                  className={"rounded px-4 py-2 text-sm font-semibold " +
                    (displayCurrency === currency
                      ? "bg-primary text-on-primary"
                      : "text-muted hover:text-foreground")}
                >
                  {currency === "KRW" ? "\uC6D0" : "$"}
                </button>
              ))}
            </div>
          </div>

          <FinancialOverviewChart
            rows={rows}
            ko={ko}
            displayCurrency={displayCurrency}
            exchangeRate={exchangeRate}
          />
          <FinancialTable
            rows={rows}
            ko={ko}
            displayCurrency={displayCurrency}
            exchangeRate={exchangeRate}
          />
        </>
      ) : null}
    </section>
  );
}

function FinancialOverviewChart({
  rows,
  ko,
  displayCurrency,
  exchangeRate,
}: {
  rows: UsStockFinancial[];
  ko: boolean;
  displayCurrency: DisplayCurrency;
  exchangeRate: number | null;
}) {
  const max = Math.max(
    ...rows.flatMap((row) => [
      Math.abs(convertFinancialValue(row.revenue, displayCurrency, exchangeRate) ?? 0),
      Math.abs(convertFinancialValue(row.operatingIncome, displayCurrency, exchangeRate) ?? 0),
    ]),
    0,
  );
  if (!rows.length || max <= 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">
          {ko ? "\uB9E4\uCD9C\u00B7\uC601\uC5C5\uC774\uC775 \uCC28\uD2B8" : "Revenue & operating income"}
        </h2>
        <div className="flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-primary" />
            {ko ? "\uB9E4\uCD9C" : "Revenue"}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-positive" />
            {ko ? "\uC601\uC5C5\uC774\uC775" : "Operating"}
          </span>
        </div>
      </div>
      <div
        className="mt-5 grid items-end gap-2 overflow-x-auto"
        style={{
          gridTemplateColumns: "repeat(" + rows.length + ", minmax(64px, 1fr))",
        }}
      >
        {rows.map((row) => {
          const revenue = convertFinancialValue(row.revenue, displayCurrency, exchangeRate);
          const operatingIncome = convertFinancialValue(row.operatingIncome, displayCurrency, exchangeRate);
          return (
            <div key={periodKey(row)} className="min-w-16">
              <div className="flex h-44 items-end justify-center gap-1 rounded bg-surface-muted p-2">
                <div
                  className="w-5 rounded-t bg-primary"
                  style={{ height: height(revenue, max) + "%" }}
                  title={formatFinancialAmount(row.revenue, displayCurrency, exchangeRate)}
                />
                <div
                  className="w-5 rounded-t bg-positive"
                  style={{ height: height(operatingIncome, max) + "%" }}
                  title={formatFinancialAmount(row.operatingIncome, displayCurrency, exchangeRate)}
                />
              </div>
              <p className="mt-2 text-center text-xs font-semibold">
                {periodLabel(row)}
              </p>
              <div className="mt-1 space-y-0.5 text-center text-[11px] text-muted">
                <p className="truncate">
                  {ko ? "\uB9E4\uCD9C" : "Revenue"} {formatFinancialAmount(row.revenue, displayCurrency, exchangeRate)}
                </p>
                <p className="truncate">
                  {ko ? "\uC601\uC5C5\uC774\uC775" : "Operating"} {formatFinancialAmount(row.operatingIncome, displayCurrency, exchangeRate)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FinancialTable({
  rows,
  ko,
  displayCurrency,
  exchangeRate,
}: {
  rows: UsStockFinancial[];
  ko: boolean;
  displayCurrency: DisplayCurrency;
  exchangeRate: number | null;
}) {
  const metrics = [
    [ko ? "\uB9E4\uCD9C" : "Revenue", "revenue"],
    [ko ? "\uC601\uC5C5\uC774\uC775" : "Operating income", "operatingIncome"],
    [ko ? "\uC21C\uC774\uC775" : "Net income", "netIncome"],
    [ko ? "\uC790\uC0B0" : "Assets", "assets"],
    [ko ? "\uBD80\uCC44" : "Liabilities", "liabilities"],
    [ko ? "\uC790\uBCF8" : "Equity", "equity"],
    ["EPS", "eps"],
  ] as const;

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="min-w-[760px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-muted text-left">
            <th className="sticky left-0 bg-surface-muted px-4 py-3">
              {ko ? "\uD56D\uBAA9" : "Metric"}
            </th>
            {rows.map((row) => (
              <th
                key={periodKey(row)}
                className="px-4 py-3 text-right"
                title={periodRangeLabel(row)}
              >
                {periodLabel(row)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map(([label, key]) => (
            <tr key={key} className="border-t border-border">
              <th className="sticky left-0 bg-surface px-4 py-3 text-left">
                {label}
              </th>
              {rows.map((row) => (
                <td key={periodKey(row)} className="px-4 py-3 text-right">
                  {key === "eps"
                    ? formatPerShareAmount(row[key], displayCurrency, exchangeRate)
                    : formatFinancialAmount(row[key], displayCurrency, exchangeRate)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-border text-xs text-muted">
            <th className="sticky left-0 bg-surface px-4 py-3 text-left">
              {ko ? "\uACF5\uC2DC\uC77C" : "Filed"}
            </th>
            {rows.map((row) => (
              <td key={periodKey(row)} className="px-4 py-3 text-right">
                {row.filedAt || "-"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function FinancialSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

function periodKey(row: UsStockFinancial) {
  return [
    row.periodType,
    row.fiscalYear,
    row.fiscalQuarter,
    row.periodStart ?? "",
    row.periodEnd ?? "",
    row.filedAt ?? "",
  ].join(":");
}

function periodRangeLabel(row: UsStockFinancial) {
  if (row.periodStart && row.periodEnd) {
    return row.periodStart + " ~ " + row.periodEnd;
  }
  return row.periodEnd || periodLabel(row);
}

function periodLabel(row: UsStockFinancial) {
  const middleDate = getPeriodMiddleDate(row.periodStart, row.periodEnd);
  if (!middleDate) {
    return row.periodType === "ANNUAL"
      ? String(row.fiscalYear)
      : row.fiscalYear + " Q" + row.fiscalQuarter;
  }

  const year = middleDate.getUTCFullYear();
  if (row.periodType === "ANNUAL") {
    return String(year);
  }

  const quarter = Math.floor(middleDate.getUTCMonth() / 3) + 1;
  return year + " Q" + quarter;
}

function getPeriodMiddleDate(start: string | null | undefined, end: string | null | undefined) {
  const endDate = parseDateOnly(end);
  if (!endDate) {
    return null;
  }

  const startDate = parseDateOnly(start);
  if (!startDate) {
    return endDate;
  }

  return new Date((startDate.getTime() + endDate.getTime()) / 2);
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value.slice(0, 10) + "T00:00:00Z");
  return Number.isNaN(date.getTime()) ? null : date;
}

function height(value: number | null, max: number) {
  return value === null || max <= 0
    ? 3
    : Math.max(3, (Math.abs(value) / max) * 100);
}

function convertFinancialValue(
  value: number | null,
  displayCurrency: DisplayCurrency,
  exchangeRate?: number | null,
) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  const converted = convertMoneyValue(value, displayCurrency, "USD", exchangeRate);
  return Number.isFinite(converted) ? converted : null;
}

function formatFinancialAmount(
  value: number | null,
  displayCurrency: DisplayCurrency,
  exchangeRate?: number | null,
) {
  const converted = convertFinancialValue(value, displayCurrency, exchangeRate);
  if (converted === null) {
    return "-";
  }
  const sign = converted < 0 ? "-" : "";
  const absolute = Math.abs(converted);
  if (displayCurrency === "KRW") {
    if (absolute >= 1e12) return sign + compact(absolute / 1e12) + "\uC870";
    if (absolute >= 1e8) return sign + compact(absolute / 1e8) + "\uC5B5";
    return sign + new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(absolute) + "\uC6D0";
  }
  if (absolute >= 1e12) return sign + "$" + compact(absolute / 1e12) + "T";
  if (absolute >= 1e9) return sign + "$" + compact(absolute / 1e9) + "B";
  if (absolute >= 1e6) return sign + "$" + compact(absolute / 1e6) + "M";
  return sign + "$" + compact(absolute);
}

function formatPerShareAmount(
  value: number | null,
  displayCurrency: DisplayCurrency,
  exchangeRate?: number | null,
) {
  const converted = convertFinancialValue(value, displayCurrency, exchangeRate);
  if (converted === null) {
    return "-";
  }
  return (displayCurrency === "KRW" ? "" : "$") +
    new Intl.NumberFormat(displayCurrency === "KRW" ? "ko-KR" : "en-US", {
      maximumFractionDigits: displayCurrency === "KRW" ? 0 : 2,
    }).format(converted) +
    (displayCurrency === "KRW" ? "\uC6D0" : "");
}

function compact(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}
