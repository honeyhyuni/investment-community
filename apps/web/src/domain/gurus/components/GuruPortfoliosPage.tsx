"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, Building2, PieChart, RefreshCw, Star } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { SectionHeader } from "@/common/components/SectionHeader";
import { SegmentedControl } from "@/common/components/SegmentedControl";
import { Skeleton } from "@/common/components/Skeleton";
import { apiRequest } from "@/common/lib/api";
import { usePreferencesStore } from "@/common/stores/preferences";
import { useSessionStore } from "@/common/stores/session";
import type {
  GuruDetail,
  GuruHolding,
  GuruSummary,
} from "@/domain/gurus/types";

type Metric = "weight" | "return";
type DetailTab = "summary" | "holdings";
type HoldingSort = "weight" | "activity";
type SortDirection = "desc" | "asc";
type ManagerSort = "value" | "positions";
type LayoutHolding = GuruHolding & { layoutValue?: number };
type Rect = { item: LayoutHolding; x: number; y: number; width: number; height: number };
type SectorBlock = { sector: string; items: LayoutHolding[]; x: number; y: number; width: number; height: number };

const money = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function formatMoney(value: number): string {
  return `$${money.format(value)}`;
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function layoutTreemap(
  items: LayoutHolding[],
  x = 0,
  y = 0,
  width = 100,
  height = 100,
  vertical = width >= height,
): Rect[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ item: items[0], x, y, width, height }];
  const sizeOf = (item: LayoutHolding) => Math.max(item.layoutValue ?? item.weight, 0);
  const total = items.reduce((sum, item) => sum + sizeOf(item), 0);
  if (total <= 0) return [];
  let running = 0;
  let split = 1;
  for (; split < items.length; split += 1) {
    running += sizeOf(items[split - 1]);
    if (running >= total / 2) break;
  }
  const first = items.slice(0, split);
  const second = items.slice(split);
  const firstWeight = first.reduce((sum, item) => sum + sizeOf(item), 0);
  const ratio = firstWeight / total;
  if (vertical) {
    const firstWidth = width * ratio;
    return [
      ...layoutTreemap(first, x, y, firstWidth, height, false),
      ...layoutTreemap(second, x + firstWidth, y, width - firstWidth, height, false),
    ];
  }
  const firstHeight = height * ratio;
  return [
    ...layoutTreemap(first, x, y, width, firstHeight, true),
    ...layoutTreemap(second, x, y + firstHeight, width, height - firstHeight, true),
  ];
}

function tileColor(item: GuruHolding): string {
  if (item.returnPercent === null) return "rgb(100, 116, 139)";
  const value = Math.max(-30, Math.min(30, item.returnPercent));
  const strength = Math.abs(value) / 30;
  if (value >= 0) {
    const lightness = 68 - strength * 34;
    return `hsl(142 72% ${lightness}%)`;
  }
  const lightness = 70 - strength * 34;
  return `hsl(0 75% ${lightness}%)`;
}

function buildSectorBlocks(items: GuruHolding[], metric: Metric): SectorBlock[] {
  const ranked = [...items]
    .filter((item) => item.returnPercent !== null)
    .sort((a, b) => (a.returnPercent ?? 0) - (b.returnPercent ?? 0));
  const returnRank = new Map(
    ranked.map((item, index) => [
      item.id,
      0.08 + Math.pow((index + 1) / Math.max(ranked.length, 1), 2),
    ]),
  );
  const layoutItems: LayoutHolding[] = items.map((item) => ({
    ...item,
    layoutValue:
      metric === "weight" ? item.weight : (returnRank.get(item.id) ?? 0.04),
  }));
  const grouped = new Map<string, LayoutHolding[]>();
  for (const item of layoutItems) {
    const group = grouped.get(item.sector) ?? [];
    group.push(item);
    grouped.set(item.sector, group);
  }
  const proxies: LayoutHolding[] = [...grouped.entries()]
    .map(([sector, sectorItems]) => ({
      ...sectorItems[0],
      id: `sector:${sector}`,
      issuerName: sector,
      weight: sectorItems.reduce((sum, item) => sum + item.weight, 0),
      layoutValue: sectorItems.reduce(
        (sum, item) => sum + (item.layoutValue ?? 0),
        0,
      ),
    }))
    .sort((a, b) => (b.layoutValue ?? 0) - (a.layoutValue ?? 0));
  return layoutTreemap(proxies).map((rect) => ({
    sector: rect.item.issuerName,
    items: (grouped.get(rect.item.issuerName) ?? []).sort(
      (a, b) => (b.layoutValue ?? 0) - (a.layoutValue ?? 0),
    ),
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }));
}

function sectorLabel(sector: string, ko: boolean): string {
  if (!ko) return sector;
  return ({
    Healthcare: "\uD5EC\uC2A4\uCF00\uC5B4",
    "Health Care": "\uD5EC\uC2A4\uCF00\uC5B4",
    Technology: "\uAE30\uC220",
    Financials: "\uAE08\uC735",
    Finance: "\uAE08\uC735",
    Energy: "\uC5D0\uB108\uC9C0",
    "Consumer Cyclical": "\uACBD\uAE30\uC18C\uBE44\uC7AC",
    "Consumer Discretionary": "\uACBD\uAE30\uC18C\uBE44\uC7AC",
    "Consumer Defensive": "\uD544\uC218\uC18C\uBE44\uC7AC",
    "Consumer Staples": "\uD544\uC218\uC18C\uBE44\uC7AC",
    Industrials: "\uC0B0\uC5C5\uC7AC",
    "Real Estate": "\uBD80\uB3D9\uC0B0",
    Utilities: "\uC720\uD2F8\uB9AC\uD2F0",
    "Communication Services": "\uCEE4\uBBA4\uB2C8\uCF00\uC774\uC158",
    Telecommunications: "\uD1B5\uC2E0",
    "Basic Materials": "\uC18C\uC7AC",
    "ETF / Fund": "ETF / \uD380\uB4DC",
    Miscellaneous: "\uAE30\uD0C0",
    Other: "\uAE30\uD0C0",
  } as Record<string, string>)[sector] ?? sector;
}

function quarterLabel(reportDate: string | null): string {
  if (!reportDate) return "";
  const date = new Date(`${reportDate}T00:00:00Z`);
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()} .Q${quarter}`.replace(" ", "");
}

function HoldingRows({
  title,
  items,
  positive,
  ko,
}: {
  title: string;
  items: GuruHolding[];
  positive: boolean;
  ko: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-3 divide-y divide-border">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {ko ? "비교할 제출 내역이 없습니다." : "No comparable filing data."}
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {item.issuerName}
                  <span className="ml-1 text-sm text-primary">
                    ({item.ticker ?? item.cusip}{item.putCall ? ` ${item.putCall.toUpperCase()}` : ""})
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {ko ? "\uBCF4\uC720\uB7C9" : "Shares"} {number.format(item.shares)}{" \u00B7 "}{ko ? "\uD604\uC7AC \uBE44\uC911" : "Current weight"} {item.weight.toFixed(2)}%
                </p>
              </div>
              <div className="text-right">
                <p className={positive ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
                  {formatPercent(item.weightChange)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {item.shareChange >= 0 ? "+" : ""}
                  {number.format(item.shareChange)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function GuruPortfoliosPage({
  slug,
  initialTab = "summary",
}: {
  slug?: string;
  initialTab?: DetailTab;
}) {
  const router = useRouter();
  const accessToken = useSessionStore((state) => state.accessToken);
  const ko = usePreferencesStore((state) => state.language) === "ko";
  const [managers, setManagers] = useState<GuruSummary[]>([]);
  const [managerSort, setManagerSort] = useState<ManagerSort>("value");
  const [managerDirection, setManagerDirection] = useState<SortDirection>("desc");
  const [detail, setDetail] = useState<GuruDetail | null>(null);
  const [metric, setMetric] = useState<Metric>("weight");
  const [detailTab, setDetailTab] = useState<DetailTab>(initialTab);
  const [holdingSort, setHoldingSort] = useState<HoldingSort>("weight");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [holdingPage, setHoldingPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setDetailTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    const path = slug
      ? `/markets/gurus/${encodeURIComponent(slug)}`
      : "/markets/gurus";
    apiRequest<GuruDetail | GuruSummary[]>(path, "GET", { accessToken })
      .then((data) => {
        if (Array.isArray(data)) setManagers(data);
        else setDetail(data);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Could not load guru portfolios."),
      )
      .finally(() => setLoading(false));
  }, [accessToken, slug]);

  const sortedManagers = useMemo(() => {
    const direction = managerDirection === "desc" ? -1 : 1;
    return [...managers].sort((a, b) => {
      const aValue = managerSort === "value" ? a.totalValue : a.positionCount;
      const bValue = managerSort === "value" ? b.totalValue : b.positionCount;
      return (aValue - bValue) * direction;
    });
  }, [managers, managerSort, managerDirection]);

  const sectorBlocks = useMemo(
    () =>
      buildSectorBlocks(
        [...(detail?.holdings ?? [])]
          .filter((holding) => holding.weight > 0)
          .sort((a, b) => b.weight - a.weight),
        metric,
      ),
    [detail, metric],
  );

  const sortedHoldings = useMemo(() => {
    const rows = [...(detail?.holdings ?? [])];
    const direction = sortDirection === "desc" ? -1 : 1;
    return rows.sort((a, b) => {
      const aValue =
        holdingSort === "weight" ? a.weight : Math.abs(a.weightChange);
      const bValue =
        holdingSort === "weight" ? b.weight : Math.abs(b.weightChange);
      return (aValue - bValue) * direction;
    });
  }, [detail, holdingSort, sortDirection]);
  const holdingPageSize = 10;
  const holdingTotalPages = Math.max(
    1,
    Math.ceil(sortedHoldings.length / holdingPageSize),
  );
  const visibleHoldings = sortedHoldings.slice(
    (holdingPage - 1) * holdingPageSize,
    holdingPage * holdingPageSize,
  );

  if (loading) {
    return <div className="grid gap-4 py-6"><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;
  }

  if (error) return <div className="py-6"><Notice message="" error={error} /></div>;

  if (!slug) {
    return (
      <div className="py-4 sm:py-6">
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
          <SectionHeader
            eyebrow="13F Portfolio"
            title={ko ? "거장" : "Gurus"}
            action={<span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{managers.length}</span>}
          />
          <p className="mt-2 text-sm text-muted">
            {ko
              ? "SEC 13F 공시를 기준으로 23개 주요 투자자와 기관의 최근 포트폴리오를 비교합니다."
              : "Compare the latest SEC 13F portfolios from 23 notable investors and institutions."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SegmentedControl<ManagerSort>
              className="w-auto"
              buttonClassName="flex-none px-3"
              value={managerSort}
              onChange={setManagerSort}
              options={[
                { value: "value", label: ko ? "13F \uADDC\uBAA8\uC21C" : "13F value" },
                { value: "positions", label: ko ? "\uBCF4\uC720\uC885\uBAA9\uC21C" : "Positions" },
              ]}
            />
            <button type="button" onClick={() => setManagerDirection((direction) => direction === "desc" ? "asc" : "desc")} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary">
              {managerDirection === "desc" ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
              {managerDirection === "desc" ? (ko ? "\uB0B4\uB9BC\uCC28\uC21C" : "Desc") : (ko ? "\uC624\uB984\uCC28\uC21C" : "Asc")}
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedManagers.map((manager) => (
              <Link
                key={manager.slug}
                href={`/gurus/${manager.slug}`}
                className="group rounded-lg border border-border bg-surface-muted p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Building2 size={19} />
                  </div>
                  <ArrowUpRight size={18} className="text-muted transition group-hover:text-primary" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">{manager.personName}</h2>
                <p className="mt-1 truncate text-sm text-muted">{manager.firmName}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-xs text-muted">{ko ? "13F 규모" : "13F value"}</p><p className="mt-1 font-semibold">{formatMoney(manager.totalValue)}</p></div>
                  <div><p className="text-xs text-muted">{ko ? "보유 종목" : "Positions"}</p><p className="mt-1 font-semibold">{manager.positionCount}</p></div>
                </div>
                <p className="mt-3 truncate text-xs text-muted">
                  {manager.topHolding
                    ? `${ko ? "최대 비중" : "Top"} · ${manager.topHolding.ticker ?? manager.topHolding.issuerName} ${manager.topHolding.weight.toFixed(1)}%`
                    : ko ? "최근 제출 자료 없음" : "No recent filing"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="grid gap-4 py-4 sm:gap-6 sm:py-6">
      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <Link href="/gurus" className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary">
          <ArrowLeft size={16} />
          {ko ? "거장 목록" : "All gurus"}
        </Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">13F Portfolio</p>
            <h2 className="mt-1 text-2xl font-bold">{detail.personName}</h2>
            <p className="mt-1 text-sm text-muted">{detail.firmName}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{formatMoney(detail.totalValue)} · {detail.positionCount} {ko ? "종목" : "positions"}</p>
            <p className="mt-1 text-xs text-muted">
              {detail.reportDate ? `${detail.reportDate} ${ko ? "기준" : "as of"}` : ko ? "최근 자료 없음" : "No recent filing"}
            </p>
          </div>
        </div>
      </section>

      <SegmentedControl<DetailTab>
        className="inline-flex w-fit max-w-full justify-self-start"
        buttonClassName="flex-none px-3 py-2"
        aria-label={ko ? "\uAC70\uC7A5 \uC0C1\uC138 \uD654\uBA74 \uC120\uD0DD" : "Guru detail view"}
        value={detailTab}
        onChange={(tab) => {
          setDetailTab(tab);
          if (!slug) return;
          router.push(tab === "holdings" ? `/gurus/${slug}/holdings` : `/gurus/${slug}`);
        }}
        options={[
          {
            value: "summary",
            label: (
              <span className="flex flex-col items-center leading-tight">
                <span className="flex items-center gap-1.5"><Star size={14} />{ko ? "\uAC70\uC7A5\uC694\uC57D" : "Summary"}</span>
                <span className="text-[11px] font-medium opacity-80">{ko ? "13F \uB9E4\uB9E4/\uBE44\uC911" : "13F activity"}</span>
              </span>
            ),
          },
          {
            value: "holdings",
            label: (
              <span className="flex flex-col items-center leading-tight">
                <span className="flex items-center gap-1.5"><PieChart size={14} />{ko ? "\uBCF4\uC720\uC885\uBAA9" : "Holdings"}</span>
                <span className="text-[11px] font-medium opacity-80">{ko ? "\uBE44\uC911/\uC218\uC775\uB960" : "Allocation"}</span>
              </span>
            ),
          },
        ]}
      />

      {detailTab === "summary" ? (
        <>
          <section className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:grid-cols-3 sm:p-5">
            <div>
              <p className="text-xs font-semibold text-muted">{ko ? "\uC804\uCCB4 \uC885\uBAA9 \uC218" : "Total positions"}</p>
              <p className="mt-1 text-2xl font-bold">{number.format(detail.stats.totalPositions)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">TOP 10 {ko ? "\uBE44\uC911" : "weight"}</p>
              <p className="mt-1 text-2xl font-bold">{detail.stats.top10Weight.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">{ko ? "\uCD94\uC815 \uD68C\uC804\uC728" : "Est. turnover"}</p>
              <p className="mt-1 text-2xl font-bold">{detail.stats.estimatedTurnover.toFixed(2)}%</p>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
            <h3 className="text-base font-semibold">{ko ? "\uBD84\uAE30 \uB9E4\uB9E4 \uB0B4\uC5ED" : "Quarterly activity"}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [ko ? "\uC2E0\uADDC\uB9E4\uC218" : "New buys", detail.stats.newBuys, "text-green-600"],
                [ko ? "\uCCAD\uC0B0\uB9E4\uB3C4" : "Sold out", detail.stats.soldOut, "text-red-600"],
                [ko ? "\uBE44\uC911\uD655\uB300" : "Increased", detail.stats.increased, "text-green-600"],
                [ko ? "\uBE44\uC911\uCD95\uC18C" : "Reduced", detail.stats.reduced, "text-red-600"],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-lg bg-surface-muted p-3">
                  <p className="text-xs font-semibold text-muted">{label}</p>
                  <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              {ko ? "\uD68C\uC804\uC728\uC740 \uC804\uBD84\uAE30 \uB300\uBE44 \uBE44\uC911 \uBCC0\uD654\uB85C \uACC4\uC0B0\uD55C \uCD94\uC815\uCE58\uC785\uB2C8\uB2E4." : "Turnover is estimated from quarter-over-quarter weight changes."}
            </p>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
        <HoldingRows title={ko ? "최근 상위 매수 Top 5" : "Top 5 recent buys"} items={detail.topBuys} positive ko={ko} />
        <HoldingRows title={ko ? "최근 상위 매도 Top 5" : "Top 5 recent sells"} items={detail.topSells} positive={false} ko={ko} />
          </div>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">13F {ko ? "\uC804\uCCB4\uBCF4\uAE30" : "All holdings"}</h3>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <SegmentedControl<HoldingSort>
                  className="min-w-0 flex-1 sm:flex-none"
                  value={holdingSort}
                  onChange={(value) => { setHoldingSort(value); setHoldingPage(1); }}
                  options={[
                    { value: "weight", label: ko ? "\uC885\uBAA9 \uBE44\uC911\uC21C" : "Weight" },
                    { value: "activity", label: ko ? "\uB9E4\uC218\uB9E4\uB3C4\uD070\uC21C" : "Activity" },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => {
                    setSortDirection((direction) => direction === "desc" ? "asc" : "desc");
                    setHoldingPage(1);
                  }}
                  className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary"
                  aria-label={sortDirection === "desc" ? (ko ? "\uB0B4\uB9BC\uCC28\uC21C" : "Descending") : (ko ? "\uC624\uB984\uCC28\uC21C" : "Ascending")}
                >
                  {sortDirection === "desc" ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                  {sortDirection === "desc" ? (ko ? "\uB0B4\uB9BC\uCC28\uC21C" : "Desc") : (ko ? "\uC624\uB984\uCC28\uC21C" : "Asc")}
                </button>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border text-xs text-muted">
                  <tr><th className="px-2 py-3">{ko ? "\uC885\uBAA9" : "Holding"}</th><th className="px-2 py-3 text-right">{ko ? "\uBCF4\uC720\uB7C9" : "Shares"}</th><th className="px-2 py-3 text-right">{ko ? "\uD3C9\uAC00\uC561" : "Value"}</th><th className="px-2 py-3 text-right">{ko ? "\uD604\uC7AC \uBE44\uC911" : "Weight"}</th><th className="px-2 py-3 text-right">{ko ? "\uBE44\uC911 \uBCC0\uD654" : "Change"}</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleHoldings.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-muted">
                      <td className="px-2 py-3"><p className="font-semibold">{item.ticker ?? item.cusip}{item.putCall ? ` ${item.putCall.toUpperCase()}` : ""}</p><p className="max-w-72 truncate text-xs text-muted">{item.issuerName}</p></td>
                      <td className="px-2 py-3 text-right">{number.format(item.shares)}</td>
                      <td className="px-2 py-3 text-right">{formatMoney(item.value)}</td>
                      <td className="px-2 py-3 text-right font-semibold">{item.weight.toFixed(2)}%</td>
                      <td className={`px-2 py-3 text-right font-semibold ${item.weightChange >= 0 ? "text-green-600" : "text-red-600"}`}>{formatPercent(item.weightChange)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <button type="button" disabled={holdingPage <= 1} onClick={() => setHoldingPage((page) => Math.max(1, page - 1))} className="cursor-pointer rounded-md border border-border px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40">{ko ? "\uC774\uC804" : "Previous"}</button>
              <span className="text-muted">{holdingPage} / {holdingTotalPages}</span>
              <button type="button" disabled={holdingPage >= holdingTotalPages} onClick={() => setHoldingPage((page) => Math.min(holdingTotalPages, page + 1))} className="cursor-pointer rounded-md border border-border px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40">{ko ? "\uB2E4\uC74C" : "Next"}</button>
            </div>
          </section>
        </>
      ) : null}

      {detailTab === "holdings" ? (
      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{ko ? "포트폴리오 맵" : "Portfolio map"}</h3>
            <p className="mt-1 text-xs text-muted">
              {ko ? `${quarterLabel(detail.reportDate)} \uAE30\uC900 \uBD84\uAE30\uB9D0\uBD80\uD130 \uD604\uC7AC\uAE4C\uC9C0 \uC218\uC775\uB960` : `Return from ${quarterLabel(detail.reportDate)} quarter-end to current`}
            </p>
          </div>
          <SegmentedControl
            value={metric}
            onChange={setMetric}
            options={[
              { value: "weight", label: ko ? "비중별" : "Weight" },
              { value: "return", label: ko ? "수익률별" : "Return" },
            ]}
          />
        </div>
        {sectorBlocks.length ? (
          <>
            <div className="mt-4 grid gap-3 rounded-lg border border-border bg-surface-muted p-3 text-xs sm:grid-cols-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{metric === "weight" ? (ko ? "\uBE44\uC911 \uC791\uC74C" : "Low weight") : (ko ? "\uC218\uC775\uB960 \uB0AE\uC74C" : "Low return")}</span>
                <div className="flex items-end gap-1" aria-hidden>
                  {[8, 12, 16, 21, 27].map((size) => (
                    <span key={size} className="inline-block rounded-sm bg-primary/70" style={{ width: size, height: size }} />
                  ))}
                </div>
                <span className="font-semibold">{metric === "weight" ? (ko ? "\uBE44\uC911 \uD07C" : "High weight") : (ko ? "\uC218\uC775\uB960 \uB192\uC74C" : "High return")}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="font-semibold">{ko ? "손실이 큼" : "Large loss"}</span>
                <span className="h-3 w-36 rounded-full bg-gradient-to-r from-red-700 via-slate-400 to-green-700" aria-hidden />
                <span className="font-semibold">{ko ? "수익이 큼" : "Large gain"}</span>
              </div>
            </div>
            <div className="relative mt-3 h-[42rem] overflow-hidden rounded-lg bg-surface-muted sm:h-[50rem] lg:h-[60rem]">
              {sectorBlocks.map((block) => (
                <div
                  key={block.sector}
                  className="absolute overflow-hidden border-2 border-background bg-surface-muted"
                  style={{ left: `${block.x}%`, top: `${block.y}%`, width: `${block.width}%`, height: `${block.height}%` }}
                >
                  <div className="flex h-6 items-center justify-between gap-1 bg-slate-900/90 px-2 text-[10px] font-bold text-white sm:text-xs">
                    <span className="truncate">{sectorLabel(block.sector, ko)}</span>
                    <span>{block.items.reduce((sum, item) => sum + item.weight, 0).toFixed(1)}%</span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 top-6">
                    {layoutTreemap(block.items).map(({ item, x, y, width, height }) => {
                      const label = metric === "weight"
                        ? `${item.weight.toFixed(2)}%`
                        : item.returnPercent === null ? "-" : formatPercent(item.returnPercent);
                      const content = (
                        <div className="flex h-full flex-col items-center justify-center overflow-hidden p-1 text-center text-white drop-shadow-sm">
                          {width > 8 && height > 8 ? <strong className="max-w-full truncate text-[10px] sm:text-xs">{item.ticker ?? item.issuerName}{item.putCall ? ` ${item.putCall.toUpperCase()}` : ""}</strong> : null}
                          {width > 11 && height > 11 ? <span className="mt-0.5 text-[9px] font-semibold sm:text-[11px]">{label}</span> : null}
                        </div>
                      );
                      const className = "absolute cursor-pointer overflow-hidden border border-white/60 transition hover:z-10 hover:brightness-110";
                      const style = { left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%`, backgroundColor: tileColor(item) };
                      const title = `${item.issuerName} (${item.ticker ?? item.cusip}${item.putCall ? ` ${item.putCall.toUpperCase()}` : ""}) \u00B7 ${sectorLabel(item.sector, ko)} / ${item.industry ?? "-"} \u00B7 ${item.weight.toFixed(2)}% \u00B7 ${item.returnPercent === null ? "-" : formatPercent(item.returnPercent)}`;
                      return item.ticker ? (
                        <Link key={item.id} href={`/?symbol=${encodeURIComponent(item.ticker)}&market=US`} className={className} style={style} title={title}>{content}</Link>
                      ) : (
                        <div key={item.id} className={className} style={style} title={title}>{content}</div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 grid h-64 place-items-center rounded-lg bg-surface-muted text-sm text-muted">
            <RefreshCw size={18} className="mb-2" />
            {ko ? "최근 13F holdings 자료가 없습니다." : "No recent 13F holdings."}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          {ko ? `13F \uC2E0\uACE0\uAE08\uC561\uACFC \uBCF4\uC720\uB7C9\uC73C\uB85C \uACC4\uC0B0\uD55C ${quarterLabel(detail.reportDate)} \uBD84\uAE30\uB9D0 \uCD94\uC815\uAC00 \uB300\uBE44 Nasdaq \uD604\uC7AC\uAC00 \uC218\uC775\uB960\uC785\uB2C8\uB2E4.` : `Return compares the implied ${quarterLabel(detail.reportDate)} quarter-end price with the latest Nasdaq price.`}
        </p>
      </section>
      ) : null}
    </div>
  );
}
