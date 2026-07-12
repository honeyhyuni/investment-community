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
  GuruConsensus,
  GuruHolding,
  GuruSummary,
} from "@/domain/gurus/types";

type Metric = "weight" | "return";
type DetailTab = "summary" | "holdings";
type HoldingSort = "weight" | "activity" | "value" | "return" | "name";
type SortDirection = "desc" | "asc";
type HoldingActivityFilter = "all" | "new" | "increased" | "reduced" | "soldOut";
type HoldingReturnFilter = "all" | "positive" | "negative" | "none";
type ManagerSort = "value" | "positions";
type RootTab = "managers" | "consensus";
type ConsensusSort = "totalValue" | "buyValue" | "sellValue" | "managerCount";
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

function isSoldOut(holding: GuruHolding): boolean {
  return holding.previousWeight > 0 && holding.weight <= 0;
}

function holdingLabel(holding: GuruHolding): string {
  return holding.ticker ?? holding.issuerName;
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
  return `${date.getUTCFullYear()} Q${quarter}`;
}

function formatKstDateTime(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function freshnessBadge(value: string | null, ko: boolean): { label: string; className: string } {
  if (!value) {
    return {
      label: ko ? "\uC218\uC9D1\uC774\uB825\uC5C6\uC74C" : "No collection log",
      className: "bg-slate-100 text-slate-600",
    };
  }
  const ageDays = (Date.now() - new Date(value).getTime()) / 86400000;
  if (ageDays <= 3) {
    return {
      label: ko ? "\uCD5C\uC2E0" : "Fresh",
      className: "bg-green-100 text-green-700",
    };
  }
  if (ageDays <= 14) {
    return {
      label: ko ? "\uC815\uC0C1" : "Current",
      className: "bg-blue-100 text-blue-700",
    };
  }
  return {
    label: ko ? "\uD655\uC778\uD544\uC694" : "Check needed",
    className: "bg-amber-100 text-amber-700",
  };
}

function FreshnessBadge({ value, ko }: { value: string | null; ko: boolean }) {
  const badge = freshnessBadge(value, ko);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}>
      {badge.label}
    </span>
  );
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
            {ko ? "비교 가능한 공시 내역이 없습니다." : "No comparable filing data."}
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {item.issuerName}
                  <span className="ml-1 text-sm text-primary">
                    ({holdingLabel(item)}{item.putCall ? ` ${item.putCall.toUpperCase()}` : ""})
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
  initialRootTab = "managers",
}: {
  slug?: string;
  initialTab?: DetailTab;
  initialRootTab?: RootTab;
}) {
  const router = useRouter();
  const accessToken = useSessionStore((state) => state.accessToken);
  const ko = usePreferencesStore((state) => state.language) === "ko";
  const [managers, setManagers] = useState<GuruSummary[]>([]);
  const [rootTab, setRootTab] = useState<RootTab>(initialRootTab);
  const [consensus, setConsensus] = useState<GuruConsensus[]>([]);
  const [consensusSort, setConsensusSort] = useState<ConsensusSort>("totalValue");
  const [managerSort, setManagerSort] = useState<ManagerSort>("value");
  const [managerDirection, setManagerDirection] = useState<SortDirection>("desc");
  const [detail, setDetail] = useState<GuruDetail | null>(null);
  const [metric, setMetric] = useState<Metric>("weight");
  const [detailTab, setDetailTab] = useState<DetailTab>(initialTab);
  const [holdingSort, setHoldingSort] = useState<HoldingSort>("weight");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [holdingSearch, setHoldingSearch] = useState("");
  const [holdingSector, setHoldingSector] = useState("all");
  const [holdingActivity, setHoldingActivity] = useState<HoldingActivityFilter>("all");
  const [holdingReturn, setHoldingReturn] = useState<HoldingReturnFilter>("all");
  const [holdingPage, setHoldingPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken || slug) return;
    const params = new URLSearchParams({ limit: '100', sort: consensusSort });
    apiRequest<GuruConsensus[]>('/markets/gurus/consensus?' + params.toString(), 'GET', { accessToken })
      .then(setConsensus)
      .catch(() => setConsensus([]));
  }, [accessToken, slug, consensusSort]);
  useEffect(() => {
    setDetailTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setRootTab(initialRootTab);
  }, [initialRootTab]);

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
  const mobileMapHoldings = useMemo(
    () =>
      [...(detail?.holdings ?? [])]
        .filter((holding) => holding.weight > 0)
        .sort((a, b) =>
          metric === 'weight'
            ? b.weight - a.weight
            : (b.returnPercent ?? Number.NEGATIVE_INFINITY) -
              (a.returnPercent ?? Number.NEGATIVE_INFINITY),
        ),
    [detail, metric],
  );

  const holdingSectorOptions = useMemo(() => {
    const sectors = [...new Set((detail?.activityHoldings ?? detail?.holdings ?? []).map((holding) => holding.sector).filter(Boolean))].sort();
    return ["all", ...sectors];
  }, [detail]);

  const tableHoldings = useMemo(
    () => detail?.activityHoldings ?? detail?.holdings ?? [],
    [detail],
  );

  const sortedHoldings = useMemo(() => {
    const query = holdingSearch.trim().toLowerCase();
    const rows = [...tableHoldings].filter((holding) => {
      if (query) {
        const haystack = [
          holding.ticker,
          holding.issuerName,
          holding.cusip,
          holding.sector,
          holding.industry,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (holdingSector !== "all" && holding.sector !== holdingSector) return false;
      if (holdingActivity === "new" && !(holding.previousWeight <= 0 && holding.weight > 0)) return false;
      if (holdingActivity === "increased" && !(holding.previousWeight > 0 && holding.weight > 0 && holding.shareChange > 0)) return false;
      if (holdingActivity === "reduced" && !(holding.previousWeight > 0 && holding.weight > 0 && holding.shareChange < 0)) return false;
      if (holdingActivity === "soldOut" && !isSoldOut(holding)) return false;
      if (holdingReturn === "positive" && !(holding.returnPercent !== null && holding.returnPercent >= 0)) return false;
      if (holdingReturn === "negative" && !(holding.returnPercent !== null && holding.returnPercent < 0)) return false;
      if (holdingReturn === "none" && holding.returnPercent !== null) return false;
      return true;
    });
    const direction = sortDirection === "desc" ? -1 : 1;
    return rows.sort((a, b) => {
      if (holdingSort === "name") {
        return a.issuerName.localeCompare(b.issuerName) * direction;
      }
      const valueOf = (item: GuruHolding) => {
        if (holdingSort === "weight") return item.weight;
        if (holdingSort === "activity") return Math.abs(item.weightChange);
        if (holdingSort === "value") return item.value;
        return item.returnPercent ?? Number.NEGATIVE_INFINITY;
      };
      return (valueOf(a) - valueOf(b)) * direction;
    });
  }, [holdingActivity, holdingReturn, holdingSearch, holdingSector, holdingSort, sortDirection, tableHoldings]);
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
      <div className="grid gap-4 py-4 sm:py-6">
        <SegmentedControl<RootTab>
          className="w-full sm:w-fit"
          value={rootTab}
          onChange={(tab) => {
            setRootTab(tab);
            router.push(tab === "consensus" ? "/gurus/trading" : "/gurus");
          }}
          options={[
            { value: "managers", label: ko ? "거장 목록" : "Gurus" },
            { value: "consensus", label: ko ? "거장 매매" : "Guru trading" },
          ]}
        />
        {rootTab === "managers" ? (
          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
            <SectionHeader eyebrow="13F Portfolio" title={ko ? "거장" : "Gurus"} action={<span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{managers.length}</span>} />
            <p className="mt-2 text-sm text-muted">{ko ? `SEC 13F 기준 ${managers.length}명의 최근 포트폴리오입니다.` : `Latest SEC 13F portfolios from ${managers.length} managers.`}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SegmentedControl<ManagerSort>
                value={managerSort}
                onChange={setManagerSort}
                options={[
                  { value: "value", label: ko ? "13F 규모" : "13F value" },
                  { value: "positions", label: ko ? "보유종목" : "Positions" },
                ]}
              />
              <button type="button" onClick={() => setManagerDirection((value) => value === "desc" ? "asc" : "desc")} className="inline-flex h-10 items-center gap-1 rounded-md border border-border px-3 text-sm font-semibold">
                {managerDirection === "desc" ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                {managerDirection === "desc" ? (ko ? "내림차순" : "Desc") : (ko ? "오름차순" : "Asc")}
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedManagers.map((manager) => (
                <Link key={manager.slug} href={`/gurus/${manager.slug}`} className="group rounded-lg border border-border bg-surface-muted p-4 transition hover:border-primary/40 hover:shadow-md">
                  <div className="flex justify-between"><Building2 className="text-primary" /><ArrowUpRight className="text-muted" /></div>
                  <h2 className="mt-4 text-lg font-semibold">{manager.personName}</h2>
                  <p className="mt-1 truncate text-sm text-muted">{manager.firmName}</p>
                  <p className="mt-3 text-sm font-semibold">{formatMoney(manager.totalValue)} · {manager.positionCount} {ko ? "종목" : "positions"}</p>
                  <p className="mt-2 text-xs text-muted">{manager.reportDate ? quarterLabel(manager.reportDate) : '-'}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionHeader eyebrow="13F Trading" title={ko ? "거장 매매" : "Guru trading"} action={<span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{managers.length} {ko ? "명 기준" : "managers"}</span>} />
                <p className="mt-2 text-sm text-muted">{ko ? "여러 거장이 보유·매수·매도한 종목을 13F 분기 변화 기준으로 집계했습니다." : "Stocks held, bought, and sold across guru 13F portfolios."}</p>
              </div>
              <SegmentedControl<ConsensusSort>
                className="w-full sm:w-fit"
                value={consensusSort}
                onChange={setConsensusSort}
                options={[
                  { value: "totalValue", label: ko ? "총 보유액" : "Total value" },
                  { value: "buyValue", label: ko ? "매수 많은순" : "Most bought" },
                  { value: "sellValue", label: ko ? "매도 많은순" : "Most sold" },
                ]}
              />
            </div>

            <div className="mt-4 grid gap-2 md:hidden">
              {consensus.map((item, index) => (
                <button key={item.ticker} onClick={() => router.push(`/?symbol=${encodeURIComponent(item.ticker)}&market=US&currency=USD`)} className="rounded-lg border border-border bg-surface-muted p-4 text-left">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0"><span className="text-xs font-bold text-primary">#{index + 1}</span><h3 className="mt-1 text-lg font-bold">{item.ticker}</h3><p className="truncate text-xs text-muted">{item.issuerName}</p></div>
                    <div className="text-right"><p className="text-xl font-bold">{item.managerCount}</p><p className="text-xs text-muted">{item.managerPercent.toFixed(1)}%</p></div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span>{ko ? "총 보유액" : "Total"}<b className="block">{formatMoney(item.totalValue)}</b></span>
                    <span>{ko ? "이번분기 순매매" : "Net trade"}<b className={item.netValueChange >= 0 ? "block text-positive" : "block text-negative"}>{formatMoney(item.netValueChange)}</b></span>
                    <span>{ko ? "TOP 매수" : "Top buyer"}<b className="block truncate text-positive">{item.topBuyManager?.personName ?? '-'}</b></span>
                    <span>{ko ? "TOP 매도" : "Top seller"}<b className="block truncate text-negative">{item.topSellManager?.personName ?? '-'}</b></span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1240px] border-separate border-spacing-x-4 border-spacing-y-0 text-sm">
                <thead className="border-b border-border text-left text-xs text-muted">
                  <tr>
                    <th className="py-3">#</th>
                    <th>{ko ? "종목" : "Stock"}</th>
                    <th className="text-right">{ko ? "보유 거장" : "Managers"}</th>
                    <th className="text-right">{ko ? "총 보유액" : "Total value"}</th>
                    <th className="text-right">{ko ? "이번분기 매수" : "Bought"}</th>
                    <th className="min-w-28 text-right">{ko ? "이번분기 매도" : "Sold"}</th>
                    <th className="min-w-44 pl-4">{ko ? "TOP 매수 기관" : "Top buyer"}</th>
                    <th className="min-w-44 pl-4">{ko ? "TOP 매도 기관" : "Top seller"}</th>
                    <th className="text-right">{ko ? "확대 / 축소" : "Raised / Reduced"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {consensus.map((item, index) => (
                    <tr key={item.ticker} onClick={() => router.push(`/?symbol=${encodeURIComponent(item.ticker)}&market=US&currency=USD`)} className="cursor-pointer hover:bg-surface-muted">
                      <td className="py-3 font-bold text-primary">{index + 1}</td>
                      <td><b>{item.ticker}</b><span className="ml-2 text-xs text-muted">{item.issuerName}</span></td>
                      <td className="text-right font-semibold">{item.managerCount}<span className="ml-1 text-xs text-muted">({item.managerPercent.toFixed(1)}%)</span></td>
                      <td className="text-right">{formatMoney(item.totalValue)}</td>
                      <td className="text-right text-positive">{formatMoney(item.buyValue)}</td>
                      <td className="min-w-28 text-right text-negative">{formatMoney(item.sellValue)}</td>
                      <td className="min-w-44 pl-4"><span className="font-semibold text-positive">{item.topBuyManager?.personName ?? '-'}</span><span className="ml-1 text-xs text-muted">{item.topBuyManager ? formatMoney(item.topBuyManager.valueChange) : ''}</span></td>
                      <td className="min-w-44 pl-4"><span className="font-semibold text-negative">{item.topSellManager?.personName ?? '-'}</span><span className="ml-1 text-xs text-muted">{item.topSellManager ? formatMoney(Math.abs(item.topSellManager.valueChange)) : ''}</span></td>
                      <td className="text-right"><span className="text-positive">{item.increasedCount}</span> / <span className="text-negative">{item.reducedCount}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!consensus.length ? <div className="py-12 text-center text-sm text-muted">{ko ? "집계할 13F 보유 데이터가 없습니다." : "No holdings available for guru trading."}</div> : null}
          </section>
        )}
      </div>
    );
  }  if (!detail) return null;

  return (
    <div className="grid min-w-0 gap-4 overflow-x-hidden py-4 sm:gap-6 sm:py-6">
      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <Link href="/gurus" className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary">
          <ArrowLeft size={16} />
          {ko ? "嫄곗옣 紐⑸줉" : "All gurus"}
        </Link>
        <div className="mt-5 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">13F Portfolio</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold">{detail.personName}</h2>
              <FreshnessBadge value={detail.lastCollectedAt} ko={ko} />
            </div>
            <p className="mt-1 text-sm text-muted">{detail.firmName}</p>
          </div>
          <div className="min-w-0 text-left text-sm sm:text-right">
            <p className="font-semibold">{formatMoney(detail.totalValue)} · {detail.positionCount} {ko ? "종목" : "positions"}</p>
            <p className="mt-1 text-xs text-muted">
              {detail.reportDate ? `${quarterLabel(detail.reportDate)} ${ko ? "기준" : "as of"}` : ko ? "최근 자료 없음" : "No recent filing"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {ko ? "\uB9C8\uC9C0\uB9C9 \uC218\uC9D1" : "Last collected"} {formatKstDateTime(detail.lastCollectedAt)} KST
            </p>
          </div>
        </div>
      </section>

      <SegmentedControl<DetailTab>
        className="sticky top-1 z-20 flex w-full min-w-0 justify-self-start shadow-sm sm:static sm:w-fit"
        buttonClassName="min-w-0 px-2 py-2 sm:flex-none sm:px-3"
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
              <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                <SegmentedControl<HoldingSort>
                  className="hidden min-w-0 flex-1 sm:flex"
                  value={holdingSort}
                  onChange={(value) => { setHoldingSort(value); setHoldingPage(1); }}
                  options={[
                    { value: "weight", label: ko ? "\uC885\uBAA9 \uBE44\uC911\uC21C" : "Weight" },
                    { value: "activity", label: ko ? "\uB9E4\uC218\uB9E4\uB3C4\uD070\uC21C" : "Activity" },
                    { value: "value", label: ko ? "\uD3C9\uAC00\uC561" : "Value" },
                    { value: "return", label: ko ? "\uC218\uC775\uB960" : "Return" },
                    { value: "name", label: ko ? "\uC885\uBAA9\uBA85" : "Name" },
                  ]}
                />
                <select
                  value={holdingSort}
                  onChange={(event) => {
                    setHoldingSort(event.target.value as HoldingSort);
                    setHoldingPage(1);
                  }}
                  className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground outline-none focus:border-primary sm:hidden"
                  aria-label={ko ? "보유종목 정렬" : "Sort holdings"}
                >
                  <option value="weight">{ko ? "종목 비중순" : "Weight"}</option>
                  <option value="activity">{ko ? "매수매도큰순" : "Activity"}</option>
                  <option value="value">{ko ? "평가액" : "Value"}</option>
                  <option value="return">{ko ? "수익률" : "Return"}</option>
                  <option value="name">{ko ? "종목명" : "Name"}</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setSortDirection((direction) => direction === "desc" ? "asc" : "desc");
                    setHoldingPage(1);
                  }}
                  className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary"
                  aria-label={sortDirection === "desc" ? (ko ? "내림차순" : "Descending") : (ko ? "오름차순" : "Ascending")}
                >
                  {sortDirection === "desc" ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                  {sortDirection === "desc" ? (ko ? "내림차순" : "Desc") : (ko ? "오름차순" : "Asc")}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 rounded-lg border border-border bg-surface-muted p-3 md:grid-cols-[minmax(180px,1fr)_repeat(3,minmax(130px,auto))]">
              <input
                value={holdingSearch}
                onChange={(event) => {
                  setHoldingSearch(event.target.value);
                  setHoldingPage(1);
                }}
                placeholder={ko ? "티커·종목명·CUSIP 검색" : "Search ticker, issuer, CUSIP"}
                className="h-10 min-w-0 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
              />
              <select
                value={holdingSector}
                onChange={(event) => {
                  setHoldingSector(event.target.value);
                  setHoldingPage(1);
                }}
                className="h-10 min-w-0 w-full rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
              >
                {holdingSectorOptions.map((sector) => (
                  <option key={sector} value={sector}>{sector === "all" ? (ko ? "전체 섹터" : "All sectors") : sectorLabel(sector, ko)}</option>
                ))}
              </select>
              <select
                value={holdingActivity}
                onChange={(event) => {
                  setHoldingActivity(event.target.value as HoldingActivityFilter);
                  setHoldingPage(1);
                }}
                className="h-10 min-w-0 w-full rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
              >
                <option value="all">{ko ? "전체 매매" : "All activity"}</option>
                <option value="new">{ko ? "신규매수" : "New buys"}</option>
                <option value="increased">{ko ? "비중확대" : "Increased"}</option>
                <option value="reduced">{ko ? "비중축소" : "Reduced"}</option>
                <option value="soldOut">{ko ? "전량매도" : "Sold out"}</option>
              </select>
              <select
                value={holdingReturn}
                onChange={(event) => {
                  setHoldingReturn(event.target.value as HoldingReturnFilter);
                  setHoldingPage(1);
                }}
                className="h-10 min-w-0 w-full rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
              >
                <option value="all">{ko ? "전체 수익률" : "All returns"}</option>
                <option value="positive">{ko ? "플러스" : "Positive"}</option>
                <option value="negative">{ko ? "마이너스" : "Negative"}</option>
                <option value="none">{ko ? "수익률 없음" : "No return"}</option>
              </select>
            </div>
            <p className="mt-2 text-xs font-semibold text-muted">
              {ko ? `${sortedHoldings.length}개 표시 / 전체 ${tableHoldings.length}개` : `${sortedHoldings.length} shown / ${tableHoldings.length} total`}
            </p>
            <div className="mt-4 grid gap-2 md:hidden">
              {visibleHoldings.map((item) => (
                <article key={item.id} className="min-w-0 rounded-md border border-border bg-surface-muted p-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {holdingLabel(item)}{item.putCall ? ` ${item.putCall.toUpperCase()}` : ""}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">{item.issuerName}</p>
                    </div>
                    {isSoldOut(item) ? <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">{ko ? "전량매도" : "Sold out"}</span> : null}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div><p className="text-muted">{ko ? "섹터" : "Sector"}</p><p className="mt-0.5 truncate font-semibold">{sectorLabel(item.sector, ko)}</p></div>
                    <div className="text-right"><p className="text-muted">{ko ? "평가액" : "Value"}</p><p className="mt-0.5 font-semibold">{formatMoney(item.value)}</p></div>
                    <div><p className="text-muted">{ko ? "현재 비중" : "Weight"}</p><p className="mt-0.5 font-semibold">{item.weight.toFixed(2)}%</p></div>
                    <div className="text-right"><p className="text-muted">{ko ? "비중 변화 / 수익률" : "Change / Return"}</p><p className="mt-0.5 font-semibold"><span className={item.weightChange >= 0 ? "text-green-600" : "text-red-600"}>{formatPercent(item.weightChange)}</span> <span className={item.returnPercent === null ? "text-muted" : item.returnPercent >= 0 ? "text-green-600" : "text-red-600"}>{item.returnPercent === null ? "-" : formatPercent(item.returnPercent)}</span></p></div>
                  </div>
                </article>
              ))}
              {!visibleHoldings.length ? <div className="py-8 text-center text-sm font-semibold text-muted">{ko ? "조건에 맞는 보유종목이 없습니다." : "No holdings match the current filters."}</div> : null}
            </div>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-border text-xs text-muted">
                  <tr><th className="px-2 py-3">{ko ? "\uC885\uBAA9" : "Holding"}</th><th className="px-2 py-3">{ko ? "\uC139\uD130" : "Sector"}</th><th className="px-2 py-3 text-right">{ko ? "\uBCF4\uC720\uB7C9" : "Shares"}</th><th className="px-2 py-3 text-right">{ko ? "\uD3C9\uAC00\uC561" : "Value"}</th><th className="px-2 py-3 text-right">{ko ? "\uD604\uC7AC \uBE44\uC911" : "Weight"}</th><th className="px-2 py-3 text-right">{ko ? "\uBE44\uC911 \uBCC0\uD654" : "Change"}</th><th className="px-2 py-3 text-right">{ko ? "\uC218\uC775\uB960" : "Return"}</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleHoldings.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-muted">
                      <td className="px-2 py-3"><p className="font-semibold">{holdingLabel(item)}{item.putCall ? ` ${item.putCall.toUpperCase()}` : ""}{isSoldOut(item) ? <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">{ko ? "\uC804\uB7C9\uB9E4\uB3C4" : "Sold out"}</span> : null}</p><p className="max-w-72 truncate text-xs text-muted">{item.ticker ? item.issuerName : item.cusip}</p></td>
                      <td className="px-2 py-3"><p className="font-semibold">{sectorLabel(item.sector, ko)}</p><p className="max-w-48 truncate text-xs text-muted">{item.industry ?? "-"}</p></td>
                      <td className="px-2 py-3 text-right">{number.format(item.shares)}</td>
                      <td className="px-2 py-3 text-right">{formatMoney(item.value)}</td>
                      <td className="px-2 py-3 text-right font-semibold">{item.weight.toFixed(2)}%</td>
                      <td className={`px-2 py-3 text-right font-semibold ${item.weightChange >= 0 ? "text-green-600" : "text-red-600"}`}>{formatPercent(item.weightChange)}</td>
                      <td className={`px-2 py-3 text-right font-semibold ${item.returnPercent === null ? "text-muted" : item.returnPercent >= 0 ? "text-green-600" : "text-red-600"}`}>{item.returnPercent === null ? "-" : formatPercent(item.returnPercent)}</td>
                    </tr>
                  ))}
                  {!visibleHoldings.length ? (
                    <tr><td colSpan={7} className="px-2 py-8 text-center text-sm font-semibold text-muted">{ko ? "조건에 맞는 보유종목이 없습니다." : "No holdings match the current filters."}</td></tr>
                  ) : null}
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
            <p className="mt-1 text-xs text-muted">
              {ko ? "\uB9C8\uC9C0\uB9C9 \uC218\uC9D1" : "Last collected"} {formatKstDateTime(detail.lastCollectedAt)} KST
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
                <span className="font-semibold">{ko ? "손실 큼" : "Large loss"}</span>
                <span className="h-3 w-36 rounded-full bg-gradient-to-r from-red-700 via-slate-400 to-green-700" aria-hidden />
                <span className="font-semibold">{ko ? "수익 큼" : "Large gain"}</span>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:hidden">
              {mobileMapHoldings.map((item) => {
                const label = metric === "weight" ? `${item.weight.toFixed(2)}%` : item.returnPercent === null ? "-" : formatPercent(item.returnPercent);
                const content = (
                  <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-surface-muted p-3">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{holdingLabel(item)}</p><p className="mt-0.5 truncate text-xs text-muted">{sectorLabel(item.sector, ko)}</p></div>
                    <span className={`shrink-0 text-sm font-bold ${metric === "return" && item.returnPercent !== null ? item.returnPercent >= 0 ? "text-green-600" : "text-red-600" : "text-foreground"}`}>{label}</span>
                  </div>
                );
                return item.ticker ? <Link key={item.id} href={`/?symbol=${encodeURIComponent(item.ticker)}&market=US`}>{content}</Link> : <div key={item.id}>{content}</div>;
              })}
            </div>
            <div className="relative mt-3 hidden h-[50rem] overflow-hidden rounded-lg bg-surface-muted sm:block lg:h-[60rem]">
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
                          {width > 8 && height > 8 ? <strong className="max-w-full truncate text-[10px] sm:text-xs">{holdingLabel(item)}{item.putCall ? ` ${item.putCall.toUpperCase()}` : ""}</strong> : null}
                          {width > 11 && height > 11 ? <span className="mt-0.5 text-[9px] font-semibold sm:text-[11px]">{label}</span> : null}
                        </div>
                      );
                      const className = "absolute cursor-pointer overflow-hidden border border-white/60 transition hover:z-10 hover:brightness-110";
                      const style = { left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%`, backgroundColor: tileColor(item) };
                      const title = `${item.issuerName} (${holdingLabel(item)}${item.putCall ? ` ${item.putCall.toUpperCase()}` : ""}) \u00B7 ${sectorLabel(item.sector, ko)} / ${item.industry ?? "-"} \u00B7 ${item.weight.toFixed(2)}% \u00B7 ${item.returnPercent === null ? "-" : formatPercent(item.returnPercent)}`;
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
            {ko ? "최근 13F 보유종목 자료가 없습니다." : "No recent 13F holdings."}
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
