"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  LayoutGrid,
  List,
  ListChecks,
  Percent,
  RefreshCw,
  Repeat2,
  X,
} from "lucide-react";
import { InfoHint } from "@/common/components/InfoHint";
import { Notice } from "@/common/components/Notice";
import { SectionHeader } from "@/common/components/SectionHeader";
import { SegmentedControl } from "@/common/components/SegmentedControl";
import { Skeleton } from "@/common/components/Skeleton";
import { apiRequest } from "@/common/lib/api";
import { usePreferencesStore } from "@/common/stores/preferences";
import { useSessionStore } from "@/common/stores/session";
import { ViewToggle } from "@/domain/calendar/components/ViewToggle";
import type {
  GuruDetail,
  GuruConsensus,
  GuruHolding,
  GuruSummary,
} from "@/domain/gurus/types";

type Metric = "weight" | "return";
type DetailTab = "summary" | "holdings";
type HoldingsView = "map" | "list";
type HoldingSort = "weight" | "activity" | "value" | "return" | "name";
type SortDirection = "desc" | "asc";
type HoldingActivityFilter =
  | "all"
  | "new"
  | "increased"
  | "reduced"
  | "soldOut";
type HoldingReturnFilter = "all" | "positive" | "negative" | "none";
type ManagerSort = "value" | "positions";
type RootTab = "managers" | "consensus";
type ConsensusSort = "totalValue" | "buyValue" | "sellValue" | "managerCount";
type LayoutHolding = GuruHolding & {
  layoutValue?: number;
  isAggregate?: boolean;
  aggregateItems?: GuruHolding[];
};
type Rect = {
  item: LayoutHolding;
  x: number;
  y: number;
  width: number;
  height: number;
};
type SectorBlock = {
  sector: string;
  items: LayoutHolding[];
  x: number;
  y: number;
  width: number;
  height: number;
};

const MAX_MAP_ITEMS_PER_SECTOR = 16;
const MIN_MAP_ITEM_WEIGHT = 0.12;

const money = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function formatMoney(value: number): string {
  return `$${money.format(value)}`;
}

function formatGuruCardMoney(value: number, ko: boolean): string {
  if (!ko) return formatMoney(value);
  const hundredMillions = value / 100_000_000;
  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: hundredMillions >= 100 ? 0 : 1,
  }).format(hundredMillions)}억 달러`;
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

function mapHoldingLabel(holding: LayoutHolding, ko: boolean): string {
  if (holding.isAggregate) {
    const count = holding.aggregateItems?.length ?? 0;
    return ko
      ? `기타 ${number.format(count)}개`
      : `Other ${number.format(count)}`;
  }
  return holdingLabel(holding);
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
  const sizeOf = (item: LayoutHolding) =>
    Math.max(item.layoutValue ?? item.weight, 0);
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
      ...layoutTreemap(
        second,
        x + firstWidth,
        y,
        width - firstWidth,
        height,
        false,
      ),
    ];
  }
  const firstHeight = height * ratio;
  return [
    ...layoutTreemap(first, x, y, width, firstHeight, true),
    ...layoutTreemap(
      second,
      x,
      y + firstHeight,
      width,
      height - firstHeight,
      true,
    ),
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

function aggregateSmallHoldings(
  sector: string,
  items: LayoutHolding[],
): LayoutHolding[] {
  if (items.length <= MAX_MAP_ITEMS_PER_SECTOR) return items;

  const visible = items.filter(
    (item, index) =>
      index < MAX_MAP_ITEMS_PER_SECTOR && item.weight >= MIN_MAP_ITEM_WEIGHT,
  );
  const hidden = items.slice(visible.length);
  if (hidden.length === 0) return items;

  const value = hidden.reduce((sum, item) => sum + item.value, 0);
  const shares = hidden.reduce((sum, item) => sum + item.shares, 0);
  const weight = hidden.reduce((sum, item) => sum + item.weight, 0);
  const previousWeight = hidden.reduce(
    (sum, item) => sum + item.previousWeight,
    0,
  );
  const weightedReturnBase = hidden.reduce(
    (sum, item) => sum + (item.returnPercent === null ? 0 : item.weight),
    0,
  );
  const returnPercent =
    weightedReturnBase > 0
      ? hidden.reduce(
          (sum, item) => sum + (item.returnPercent ?? 0) * item.weight,
          0,
        ) / weightedReturnBase
      : null;

  return [
    ...visible,
    {
      id: `aggregate:${sector}`,
      ticker: null,
      issuerName: `Other ${hidden.length}`,
      cusip: "",
      putCall: null,
      value,
      shares,
      weight,
      previousWeight,
      weightChange: weight - previousWeight,
      shareChange: hidden.reduce((sum, item) => sum + item.shareChange, 0),
      returnPercent,
      industry: null,
      sector,
      layoutValue: hidden.reduce(
        (sum, item) => sum + (item.layoutValue ?? item.weight),
        0,
      ),
      isAggregate: true,
      aggregateItems: hidden,
    },
  ];
}

function buildSectorBlocks(
  items: GuruHolding[],
  metric: Metric,
): SectorBlock[] {
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
  const displayGroups = new Map<string, LayoutHolding[]>();
  for (const [sector, sectorItems] of grouped.entries()) {
    displayGroups.set(
      sector,
      aggregateSmallHoldings(
        sector,
        sectorItems.sort((a, b) => (b.layoutValue ?? 0) - (a.layoutValue ?? 0)),
      ),
    );
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
    items: (displayGroups.get(rect.item.issuerName) ?? []).sort(
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
  return (
    (
      {
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
      } as Record<string, string>
    )[sector] ?? sector
  );
}

function localizedQuarterLabel(reportDate: string | null, ko: boolean): string {
  if (!reportDate) return "";
  const date = new Date(`${reportDate}T00:00:00Z`);
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return ko
    ? `${date.getUTCFullYear()}년 ${quarter}분기`
    : `${date.getUTCFullYear()} Q${quarter}`;
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

function freshnessBadge(
  value: string | null,
  ko: boolean,
): { label: string; className: string } {
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
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

function DetailInfoBlock({
  icon: Icon,
  label,
  value,
  valueClassName = "text-foreground",
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-subtle text-muted">
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <p
          className={`mt-0.5 truncate text-sm font-semibold leading-5 ${valueClassName}`}
        >
          {value}
        </p>
      </div>
    </div>
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
    <section className="rounded-lg bg-surface-muted p-4">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-3 divide-y divide-border">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {ko
              ? "비교 가능한 공시 내역이 없습니다."
              : "No comparable filing data."}
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {item.issuerName}
                  <span className="ml-1 text-sm text-primary">
                    ({holdingLabel(item)}
                    {item.putCall ? ` ${item.putCall.toUpperCase()}` : ""})
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {ko ? "\uBCF4\uC720\uB7C9" : "Shares"}{" "}
                  {number.format(item.shares)}
                  {" \u00B7 "}
                  {ko ? "\uD604\uC7AC \uBE44\uC911" : "Current weight"}{" "}
                  {item.weight.toFixed(2)}%
                </p>
              </div>
              <div className="text-right">
                <p
                  className={
                    positive
                      ? "font-semibold text-green-600"
                      : "font-semibold text-red-600"
                  }
                >
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
  const [consensusSort, setConsensusSort] =
    useState<ConsensusSort>("totalValue");
  const [managerSort, setManagerSort] = useState<ManagerSort>("value");
  const [managerDirection, setManagerDirection] =
    useState<SortDirection>("desc");
  const [detail, setDetail] = useState<GuruDetail | null>(null);
  const [metric, setMetric] = useState<Metric>("weight");
  const [holdingsView, setHoldingsView] = useState<HoldingsView>("map");
  const [selectedMapGroup, setSelectedMapGroup] =
    useState<LayoutHolding | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>(initialTab);
  const [holdingSort, setHoldingSort] = useState<HoldingSort>("weight");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [holdingSearch, setHoldingSearch] = useState("");
  const [holdingSector, setHoldingSector] = useState("all");
  const [holdingActivity, setHoldingActivity] =
    useState<HoldingActivityFilter>("all");
  const [holdingReturn, setHoldingReturn] =
    useState<HoldingReturnFilter>("all");
  const [holdingPage, setHoldingPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken || slug) return;
    const params = new URLSearchParams({ limit: "100", sort: consensusSort });
    apiRequest<GuruConsensus[]>(
      "/markets/gurus/consensus?" + params.toString(),
      "GET",
      { accessToken },
    )
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
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load guru portfolios.",
        ),
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
          metric === "weight"
            ? b.weight - a.weight
            : (b.returnPercent ?? Number.NEGATIVE_INFINITY) -
              (a.returnPercent ?? Number.NEGATIVE_INFINITY),
        ),
    [detail, metric],
  );

  const holdingSectorOptions = useMemo(() => {
    const sectors = [
      ...new Set(
        (detail?.activityHoldings ?? detail?.holdings ?? [])
          .map((holding) => holding.sector)
          .filter(Boolean),
      ),
    ].sort();
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
      if (holdingSector !== "all" && holding.sector !== holdingSector)
        return false;
      if (
        holdingActivity === "new" &&
        !(holding.previousWeight <= 0 && holding.weight > 0)
      )
        return false;
      if (
        holdingActivity === "increased" &&
        !(
          holding.previousWeight > 0 &&
          holding.weight > 0 &&
          holding.shareChange > 0
        )
      )
        return false;
      if (
        holdingActivity === "reduced" &&
        !(
          holding.previousWeight > 0 &&
          holding.weight > 0 &&
          holding.shareChange < 0
        )
      )
        return false;
      if (holdingActivity === "soldOut" && !isSoldOut(holding)) return false;
      if (
        holdingReturn === "positive" &&
        !(holding.returnPercent !== null && holding.returnPercent >= 0)
      )
        return false;
      if (
        holdingReturn === "negative" &&
        !(holding.returnPercent !== null && holding.returnPercent < 0)
      )
        return false;
      if (holdingReturn === "none" && holding.returnPercent !== null)
        return false;
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
  }, [
    holdingActivity,
    holdingReturn,
    holdingSearch,
    holdingSector,
    holdingSort,
    sortDirection,
    tableHoldings,
  ]);
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
    return (
      <div className="grid gap-4 py-6">
        <Skeleton className="h-28" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error)
    return (
      <div className="py-6">
        <Notice message="" error={error} />
      </div>
    );

  if (!slug) {
    const rootTabs = (
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
    );

    return (
      <div className="grid gap-4 py-4 sm:py-6">
        {rootTab === "managers" ? (
          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
            <SectionHeader
              eyebrow="13F Portfolio"
              title={ko ? "거장" : "Gurus"}
            />
            <div className="mt-4">{rootTabs}</div>
            <InfoHint className="mt-4 w-fit max-w-full">
              {ko
                ? `SEC 13F 기준 ${managers.length}명의 최근 포트폴리오입니다.`
                : `Latest SEC 13F portfolios from ${managers.length} managers.`}
            </InfoHint>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ViewToggle<ManagerSort>
                aria-label={ko ? "거장 목록 정렬" : "Guru sort"}
                value={managerSort}
                onChange={setManagerSort}
                options={[
                  { value: "value", label: ko ? "13F 규모" : "13F value" },
                  { value: "positions", label: ko ? "보유종목" : "Positions" },
                ]}
              />
              <div className="ml-auto inline-flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setManagerDirection((value) =>
                      value === "desc" ? "asc" : "desc",
                    )
                  }
                  className="flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                >
                  {managerDirection === "desc" ? (
                    <ArrowDown size={13} />
                  ) : (
                    <ArrowUp size={13} />
                  )}
                  {managerDirection === "desc"
                    ? ko
                      ? "내림차순"
                      : "Desc"
                    : ko
                      ? "오름차순"
                      : "Asc"}
                </button>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedManagers.map((manager, index) => (
                <Link
                  key={manager.slug}
                  href={`/gurus/${manager.slug}`}
                  className="group flex min-h-40 cursor-pointer flex-col rounded-md border border-border bg-surface p-4 text-left shadow-sm transition-all duration-150 ease-out will-change-transform hover:scale-[1.01] hover:bg-surface-muted hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold leading-tight text-foreground">
                        {manager.personName}
                      </h2>
                      <p className="mt-1 truncate text-sm text-muted">
                        {manager.firmName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right leading-snug">
                      <p className="text-xs font-bold text-primary">
                        #{index + 1}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-muted">
                        {ko ? "13F 기준" : "13F as of"}
                        <br />
                        {manager.reportDate
                          ? localizedQuarterLabel(manager.reportDate, ko)
                          : "-"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto pt-4">
                    <div className="flex items-end justify-between gap-3 rounded-md bg-surface-subtle px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-muted">
                          {ko ? "포트폴리오 규모" : "Portfolio value"}
                        </p>
                        <p className="mt-0.5 truncate text-lg font-bold leading-tight text-primary">
                          {formatGuruCardMoney(manager.totalValue, ko)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] font-semibold text-muted">
                          {ko ? "종목" : "Positions"}
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-foreground">
                          {number.format(manager.positionCount)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionHeader
                  eyebrow="13F Trading"
                  title={ko ? "거장 매매" : "Guru trading"}
                />
                <div className="mt-4">{rootTabs}</div>
                <InfoHint className="mt-4 w-fit max-w-full">
                  {ko
                    ? "여러 거장이 보유·매수·매도한 종목을 13F 분기 변화 기준으로 집계했습니다."
                    : "Stocks held, bought, and sold across guru 13F portfolios."}
                </InfoHint>
              </div>
              <SegmentedControl<ConsensusSort>
                className="w-full sm:w-fit"
                value={consensusSort}
                onChange={setConsensusSort}
                options={[
                  {
                    value: "totalValue",
                    label: ko ? "총 보유액" : "Total value",
                  },
                  {
                    value: "buyValue",
                    label: ko ? "매수 많은순" : "Most bought",
                  },
                  {
                    value: "sellValue",
                    label: ko ? "매도 많은순" : "Most sold",
                  },
                ]}
              />
            </div>

            <div className="mt-4 grid gap-2 md:hidden">
              {consensus.map((item, index) => (
                <button
                  key={item.ticker}
                  onClick={() =>
                    router.push(
                      `/?symbol=${encodeURIComponent(item.ticker)}&market=US&currency=USD`,
                    )
                  }
                  className="rounded-lg border border-border bg-surface-muted p-4 text-left"
                >
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-primary">
                        #{index + 1}
                      </span>
                      <h3 className="mt-1 text-lg font-bold">{item.ticker}</h3>
                      <p className="truncate text-xs text-muted">
                        {item.issuerName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{item.managerCount}</p>
                      <p className="text-xs text-muted">
                        {item.managerPercent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span>
                      {ko ? "총 보유액" : "Total"}
                      <b className="block">{formatMoney(item.totalValue)}</b>
                    </span>
                    <span>
                      {ko ? "이번분기 순매매" : "Net trade"}
                      <b
                        className={
                          item.netValueChange >= 0
                            ? "block text-positive"
                            : "block text-negative"
                        }
                      >
                        {formatMoney(item.netValueChange)}
                      </b>
                    </span>
                    <span>
                      {ko ? "TOP 매수" : "Top buyer"}
                      <b className="block truncate text-positive">
                        {item.topBuyManager?.personName ?? "-"}
                      </b>
                    </span>
                    <span>
                      {ko ? "TOP 매도" : "Top seller"}
                      <b className="block truncate text-negative">
                        {item.topSellManager?.personName ?? "-"}
                      </b>
                    </span>
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
                    <th className="text-right">
                      {ko ? "보유 거장" : "Managers"}
                    </th>
                    <th className="text-right">
                      {ko ? "총 보유액" : "Total value"}
                    </th>
                    <th className="text-right">
                      {ko ? "이번분기 매수" : "Bought"}
                    </th>
                    <th className="min-w-28 text-right">
                      {ko ? "이번분기 매도" : "Sold"}
                    </th>
                    <th className="min-w-44 pl-4">
                      {ko ? "TOP 매수 기관" : "Top buyer"}
                    </th>
                    <th className="min-w-44 pl-4">
                      {ko ? "TOP 매도 기관" : "Top seller"}
                    </th>
                    <th className="text-right">
                      {ko ? "확대 / 축소" : "Raised / Reduced"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {consensus.map((item, index) => (
                    <tr
                      key={item.ticker}
                      onClick={() =>
                        router.push(
                          `/?symbol=${encodeURIComponent(item.ticker)}&market=US&currency=USD`,
                        )
                      }
                      className="cursor-pointer hover:bg-surface-muted"
                    >
                      <td className="py-3 font-bold text-primary">
                        {index + 1}
                      </td>
                      <td>
                        <b>{item.ticker}</b>
                        <span className="ml-2 text-xs text-muted">
                          {item.issuerName}
                        </span>
                      </td>
                      <td className="text-right font-semibold">
                        {item.managerCount}
                        <span className="ml-1 text-xs text-muted">
                          ({item.managerPercent.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="text-right">
                        {formatMoney(item.totalValue)}
                      </td>
                      <td className="text-right text-positive">
                        {formatMoney(item.buyValue)}
                      </td>
                      <td className="min-w-28 text-right text-negative">
                        {formatMoney(item.sellValue)}
                      </td>
                      <td className="min-w-44 pl-4">
                        <span className="font-semibold text-positive">
                          {item.topBuyManager?.personName ?? "-"}
                        </span>
                        <span className="ml-1 text-xs text-muted">
                          {item.topBuyManager
                            ? formatMoney(item.topBuyManager.valueChange)
                            : ""}
                        </span>
                      </td>
                      <td className="min-w-44 pl-4">
                        <span className="font-semibold text-negative">
                          {item.topSellManager?.personName ?? "-"}
                        </span>
                        <span className="ml-1 text-xs text-muted">
                          {item.topSellManager
                            ? formatMoney(
                                Math.abs(item.topSellManager.valueChange),
                              )
                            : ""}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="text-positive">
                          {item.increasedCount}
                        </span>{" "}
                        /{" "}
                        <span className="text-negative">
                          {item.reducedCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!consensus.length ? (
              <div className="py-12 text-center text-sm text-muted">
                {ko
                  ? "집계할 13F 보유 데이터가 없습니다."
                  : "No holdings available for guru trading."}
              </div>
            ) : null}
          </section>
        )}
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div className="grid min-w-0 gap-4 overflow-x-hidden py-4 sm:gap-6 sm:py-6">
      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/gurus"
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary"
          >
            <ArrowLeft size={16} />
            {ko ? "거장 목록" : "All gurus"}
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted">
            <span>
              {ko ? "13F 기준" : "13F as of"}{" "}
              {detail.reportDate
                ? localizedQuarterLabel(detail.reportDate, ko)
                : "-"}
            </span>
          </div>
        </div>
        <div className="mt-5 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-3xl font-bold leading-tight">
              {detail.personName}
            </h2>
            <p className="mt-1 text-sm text-muted">{detail.firmName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted sm:justify-end">
            <span>
              {ko ? "마지막 수집" : "Last collected"}{" "}
              {formatKstDateTime(detail.lastCollectedAt)} KST
            </span>
            <FreshnessBadge value={detail.lastCollectedAt} ko={ko} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <nav
          aria-label={ko ? "거장 상세 화면 선택" : "Guru detail view"}
          className="-mx-4 flex gap-2 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden"
        >
          {(
            [
              {
                value: "summary",
                href: `/gurus/${slug}`,
                label: ko ? "거장요약" : "Summary",
              },
              {
                value: "holdings",
                href: `/gurus/${slug}/holdings`,
                label: ko ? "전체 종목" : "All holdings",
              },
            ] as Array<{ value: DetailTab; href: string; label: string }>
          ).map((tab) => {
            const active = detailTab === tab.value;
            return (
              <Link
                key={tab.value}
                href={tab.href}
                onClick={() => setDetailTab(tab.value)}
                className={`flex h-11 shrink-0 cursor-pointer items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:border-border-strong hover:text-primary"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 grid gap-4">
          {detailTab === "summary" ? (
            <>
              <section className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
                <div className="rounded-lg bg-primary/5 px-4 py-3 lg:flex lg:flex-col lg:items-center lg:justify-center lg:text-center">
                  <p className="text-xs font-semibold text-primary/80">
                    {ko ? "포트폴리오 규모" : "Portfolio value"}
                  </p>
                  <p className="mt-1 text-3xl font-bold leading-tight text-primary lg:text-4xl">
                    {formatGuruCardMoney(detail.totalValue, ko)}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-muted">
                    {ko
                      ? `${localizedQuarterLabel(detail.reportDate, ko)} 13F 기준 보유 평가액`
                      : `${localizedQuarterLabel(detail.reportDate, ko)} 13F reported value`}
                  </p>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
                  <DetailInfoBlock
                    icon={ListChecks}
                    label={ko ? "보유종목" : "Positions"}
                    value={number.format(detail.positionCount)}
                  />
                  <DetailInfoBlock
                    icon={Percent}
                    label={`TOP 10 ${ko ? "비중" : "weight"}`}
                    value={`${detail.stats.top10Weight.toFixed(2)}%`}
                  />
                  <DetailInfoBlock
                    icon={Repeat2}
                    label={ko ? "추정 회전율" : "Est. turnover"}
                    value={`${detail.stats.estimatedTurnover.toFixed(2)}%`}
                  />
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">
                      {ko
                        ? "\uBD84\uAE30 \uB9E4\uB9E4 \uB0B4\uC5ED"
                        : "Quarterly activity"}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      {ko
                        ? "전분기 대비 보유 변화 기준"
                        : "Based on quarter-over-quarter holding changes"}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-muted">
                    {ko
                      ? "매수/확대는 초록, 매도/축소는 빨강"
                      : "Buys/increases in green, sells/reductions in red"}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    {
                      label: ko ? "\uC2E0\uADDC\uB9E4\uC218" : "New buys",
                      value: detail.stats.newBuys,
                      tone: "positive",
                    },
                    {
                      label: ko ? "\uBE44\uC911\uD655\uB300" : "Increased",
                      value: detail.stats.increased,
                      tone: "positive",
                    },
                    {
                      label: ko ? "\uBE44\uC911\uCD95\uC18C" : "Reduced",
                      value: detail.stats.reduced,
                      tone: "negative",
                    },
                    {
                      label: ko ? "\uCCAD\uC0B0\uB9E4\uB3C4" : "Sold out",
                      value: detail.stats.soldOut,
                      tone: "negative",
                    },
                  ].map((item) => {
                    const positive = item.tone === "positive";
                    return (
                      <div
                        key={item.label}
                        className={`rounded-md px-3 py-2.5 ${positive ? "bg-green-50" : "bg-red-50"}`}
                      >
                        <p className="text-xs font-semibold text-muted">
                          {item.label}
                        </p>
                        <p
                          className={`mt-2 text-2xl font-bold leading-none ${positive ? "text-green-600" : "text-red-600"}`}
                        >
                          {item.value}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-muted">
                  {ko
                    ? "\uD68C\uC804\uC728\uC740 \uC804\uBD84\uAE30 \uB300\uBE44 \uBE44\uC911 \uBCC0\uD654\uB85C \uACC4\uC0B0\uD55C \uCD94\uC815\uCE58\uC785\uB2C8\uB2E4."
                    : "Turnover is estimated from quarter-over-quarter weight changes."}
                </p>
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <HoldingRows
                  title={ko ? "최근 상위 매수 Top 5" : "Top 5 recent buys"}
                  items={detail.topBuys}
                  positive
                  ko={ko}
                />
                <HoldingRows
                  title={ko ? "최근 상위 매도 Top 5" : "Top 5 recent sells"}
                  items={detail.topSells}
                  positive={false}
                  ko={ko}
                />
              </div>
            </>
          ) : null}

          {detailTab === "holdings" ? (
            <>
              <div>
                <h3 className="text-lg font-semibold">
                  {ko ? "전체 종목" : "All holdings"}
                </h3>
                <InfoHint className="mt-2 w-fit max-w-full">
                  {holdingsView === "map"
                    ? ko
                      ? `13F \uC2E0\uACE0\uAE08\uC561\uACFC \uBCF4\uC720\uB7C9\uC73C\uB85C \uACC4\uC0B0\uD55C ${localizedQuarterLabel(detail.reportDate, ko)} \uBD84\uAE30\uB9D0 \uCD94\uC815\uAC00 \uB300\uBE44 Nasdaq \uD604\uC7AC\uAC00 \uC218\uC775\uB960\uC785\uB2C8\uB2E4.`
                      : `Return compares the implied ${localizedQuarterLabel(detail.reportDate, ko)} quarter-end price from 13F value and shares with the latest Nasdaq price.`
                    : ko
                      ? "13F 보유종목을 필터와 정렬로 확인합니다."
                      : "Filter and sort the full 13F holdings list."}
                </InfoHint>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SegmentedControl<HoldingsView>
                  className="w-full sm:w-fit"
                  buttonClassName="gap-1.5 px-3"
                  aria-label={ko ? "보유종목 보기 방식" : "Holdings view"}
                  value={holdingsView}
                  onChange={(value) => {
                    setSelectedMapGroup(null);
                    setHoldingsView(value);
                  }}
                  options={[
                    {
                      value: "map",
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <LayoutGrid size={15} />
                          {ko ? "맵" : "Map"}
                        </span>
                      ),
                    },
                    {
                      value: "list",
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <List size={15} />
                          {ko ? "목록" : "List"}
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
              <section className="rounded-lg bg-surface-muted p-4 sm:p-5">
                {holdingsView === "map" ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <ViewToggle<Metric>
                      aria-label={
                        ko ? "포트폴리오 맵 기준" : "Portfolio map metric"
                      }
                      value={metric}
                      onChange={(value) => {
                        setSelectedMapGroup(null);
                        setMetric(value);
                      }}
                      options={[
                        { value: "weight", label: ko ? "비중별" : "Weight" },
                        { value: "return", label: ko ? "수익률별" : "Return" },
                      ]}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-muted sm:justify-end">
                      <div className="inline-flex min-h-9 items-center gap-2 rounded-md bg-surface px-3 py-1.5">
                        <span className="whitespace-nowrap">
                          {metric === "weight"
                            ? ko
                              ? "비중"
                              : "Weight"
                            : ko
                              ? "수익률"
                              : "Return"}
                        </span>
                        <div className="flex h-6 items-end gap-0.5" aria-hidden>
                          {[9, 13, 17, 22, 28].map((size) => (
                            <span
                              key={size}
                              className="inline-block rounded-[2px] bg-primary/70"
                              style={{ width: size, height: size }}
                            />
                          ))}
                        </div>
                        <span className="whitespace-nowrap text-xs text-muted">
                          {ko ? "작음 → 큼" : "Low → High"}
                        </span>
                      </div>
                      <div className="inline-flex min-h-9 items-center gap-2 rounded-md bg-surface px-3 py-1.5">
                        <span className="whitespace-nowrap text-red-600">
                          {ko ? "손실" : "Loss"}
                        </span>
                        <span
                          className="h-2.5 w-24 rounded-full bg-gradient-to-r from-red-700 via-slate-400 to-green-700"
                          aria-hidden
                        />
                        <span className="whitespace-nowrap text-green-600">
                          {ko ? "수익" : "Gain"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
                {holdingsView === "map" ? (
                  <>
                    {sectorBlocks.length ? (
                      <>
                        <div className="mt-4 grid gap-2 sm:hidden">
                          {mobileMapHoldings.map((item) => {
                            const label =
                              metric === "weight"
                                ? `${item.weight.toFixed(2)}%`
                                : item.returnPercent === null
                                  ? "-"
                                  : formatPercent(item.returnPercent);
                            const content = (
                              <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-surface-muted p-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">
                                    {holdingLabel(item)}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs text-muted">
                                    {sectorLabel(item.sector, ko)}
                                  </p>
                                </div>
                                <span
                                  className={`shrink-0 text-sm font-bold ${metric === "return" && item.returnPercent !== null ? (item.returnPercent >= 0 ? "text-green-600" : "text-red-600") : "text-foreground"}`}
                                >
                                  {label}
                                </span>
                              </div>
                            );
                            return item.ticker ? (
                              <Link
                                key={item.id}
                                href={`/?symbol=${encodeURIComponent(item.ticker)}&market=US`}
                              >
                                {content}
                              </Link>
                            ) : (
                              <div key={item.id}>{content}</div>
                            );
                          })}
                        </div>
                        <div className="relative mt-4 hidden h-[50rem] overflow-hidden rounded-lg bg-surface-muted sm:block lg:h-[60rem]">
                          {sectorBlocks.map((block) => (
                            <div
                              key={block.sector}
                              className="absolute overflow-hidden border-2 border-background bg-surface-muted"
                              style={{
                                left: `${block.x}%`,
                                top: `${block.y}%`,
                                width: `${block.width}%`,
                                height: `${block.height}%`,
                              }}
                            >
                              <div className="flex h-6 items-center justify-between gap-1 bg-slate-900/90 px-2 text-[10px] font-bold text-white sm:text-xs">
                                <span className="truncate">
                                  {sectorLabel(block.sector, ko)}
                                </span>
                                <span>
                                  {block.items
                                    .reduce((sum, item) => sum + item.weight, 0)
                                    .toFixed(1)}
                                  %
                                </span>
                              </div>
                              <div className="absolute inset-x-0 bottom-0 top-6">
                                {layoutTreemap(block.items).map(
                                  ({ item, x, y, width, height }) => {
                                    const label =
                                      metric === "weight"
                                        ? `${item.weight.toFixed(2)}%`
                                        : item.returnPercent === null
                                          ? "-"
                                          : formatPercent(item.returnPercent);
                                    const displayLabel = mapHoldingLabel(
                                      item,
                                      ko,
                                    );
                                    const content = (
                                      <div className="flex h-full flex-col items-center justify-center overflow-hidden p-1 text-center text-white drop-shadow-sm">
                                        {width > 8 && height > 8 ? (
                                          <strong className="max-w-full truncate text-[10px] sm:text-xs">
                                            {displayLabel}
                                            {item.putCall
                                              ? ` ${item.putCall.toUpperCase()}`
                                              : ""}
                                          </strong>
                                        ) : null}
                                        {width > 11 && height > 11 ? (
                                          <span className="mt-0.5 text-[9px] font-semibold sm:text-[11px]">
                                            {label}
                                          </span>
                                        ) : null}
                                      </div>
                                    );
                                    const selected =
                                      selectedMapGroup?.id === item.id;
                                    const className = `absolute cursor-pointer overflow-hidden border transition hover:z-10 hover:brightness-110 ${
                                      selected
                                        ? "z-10 border-white ring-2 ring-primary ring-offset-2 ring-offset-background"
                                        : "border-white/60"
                                    }`;
                                    const style = {
                                      left: `${x}%`,
                                      top: `${y}%`,
                                      width: `${width}%`,
                                      height: `${height}%`,
                                      backgroundColor: item.isAggregate
                                        ? "rgb(71, 85, 105)"
                                        : tileColor(item),
                                    };
                                    const title = item.isAggregate
                                      ? `${displayLabel} \u00B7 ${sectorLabel(item.sector, ko)} \u00B7 ${item.weight.toFixed(2)}%`
                                      : `${item.issuerName} (${holdingLabel(item)}${item.putCall ? ` ${item.putCall.toUpperCase()}` : ""}) \u00B7 ${sectorLabel(item.sector, ko)} / ${item.industry ?? "-"} \u00B7 ${item.weight.toFixed(2)}% \u00B7 ${item.returnPercent === null ? "-" : formatPercent(item.returnPercent)}`;
                                    if (item.isAggregate) {
                                      return (
                                        <button
                                          key={item.id}
                                          type="button"
                                          onClick={() =>
                                            setSelectedMapGroup(item)
                                          }
                                          className={className}
                                          style={style}
                                          title={title}
                                        >
                                          {content}
                                        </button>
                                      );
                                    }
                                    return item.ticker ? (
                                      <Link
                                        key={item.id}
                                        href={`/?symbol=${encodeURIComponent(item.ticker)}&market=US`}
                                        className={className}
                                        style={style}
                                        title={title}
                                      >
                                        {content}
                                      </Link>
                                    ) : (
                                      <div
                                        key={item.id}
                                        className={className}
                                        style={style}
                                        title={title}
                                      >
                                        {content}
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {selectedMapGroup?.aggregateItems?.length ? (
                          <section className="mt-3 rounded-lg bg-surface p-3 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-muted">
                                  {sectorLabel(selectedMapGroup.sector, ko)}
                                </p>
                                <h4 className="mt-0.5 text-base font-bold">
                                  {mapHoldingLabel(selectedMapGroup, ko)}
                                </h4>
                                <p className="mt-1 text-xs text-muted">
                                  {ko
                                    ? `${selectedMapGroup.weight.toFixed(2)}% · ${formatMoney(selectedMapGroup.value)} 규모의 소형 보유 종목을 묶었습니다.`
                                    : `${selectedMapGroup.weight.toFixed(2)}% · ${formatMoney(selectedMapGroup.value)} grouped smaller holdings.`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHoldingSector(selectedMapGroup.sector);
                                    setHoldingPage(1);
                                    setHoldingsView("list");
                                  }}
                                  className="h-8 cursor-pointer rounded-md bg-primary px-3 text-xs font-bold text-white transition hover:bg-primary/90"
                                >
                                  {ko ? "목록에서 보기" : "View in list"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedMapGroup(null)}
                                  className="grid size-8 cursor-pointer place-items-center rounded-md text-muted transition hover:bg-surface-subtle hover:text-foreground"
                                  aria-label={ko ? "닫기" : "Close"}
                                >
                                  <X size={15} />
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {selectedMapGroup.aggregateItems
                                .slice(0, 12)
                                .map((item) => {
                                  const itemReturn =
                                    item.returnPercent === null
                                      ? "-"
                                      : formatPercent(item.returnPercent);
                                  const row = (
                                    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-surface-muted px-3 py-2 text-sm transition hover:bg-surface-subtle">
                                      <div className="min-w-0">
                                        <p className="truncate font-semibold">
                                          {holdingLabel(item)}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-muted">
                                          {item.issuerName}
                                        </p>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <p className="font-bold">
                                          {item.weight.toFixed(2)}%
                                        </p>
                                        <p
                                          className={`mt-0.5 text-xs font-semibold ${
                                            item.returnPercent === null
                                              ? "text-muted"
                                              : item.returnPercent >= 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                          }`}
                                        >
                                          {itemReturn}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                  return item.ticker ? (
                                    <Link
                                      key={item.id}
                                      href={`/?symbol=${encodeURIComponent(item.ticker)}&market=US`}
                                    >
                                      {row}
                                    </Link>
                                  ) : (
                                    <div key={item.id}>{row}</div>
                                  );
                                })}
                            </div>
                            {selectedMapGroup.aggregateItems.length > 12 ? (
                              <p className="mt-3 text-xs font-semibold text-muted">
                                {ko
                                  ? `외 ${number.format(selectedMapGroup.aggregateItems.length - 12)}개 종목은 목록에서 확인할 수 있습니다.`
                                  : `${number.format(selectedMapGroup.aggregateItems.length - 12)} more holdings are available in the list view.`}
                              </p>
                            ) : null}
                          </section>
                        ) : null}
                      </>
                    ) : (
                      <div className="mt-4 grid h-64 place-items-center rounded-lg bg-surface-muted text-sm text-muted">
                        <RefreshCw size={18} className="mb-2" />
                        {ko
                          ? "최근 13F 보유종목 자료가 없습니다."
                          : "No recent 13F holdings."}
                      </div>
                    )}
                  </>
                ) : (
                  <section className="mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-base font-semibold">
                        13F {ko ? "\uC804\uCCB4\uBCF4\uAE30" : "All holdings"}
                      </h4>
                      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                        <SegmentedControl<HoldingSort>
                          className="hidden min-w-0 flex-1 sm:flex"
                          value={holdingSort}
                          onChange={(value) => {
                            setHoldingSort(value);
                            setHoldingPage(1);
                          }}
                          options={[
                            {
                              value: "weight",
                              label: ko
                                ? "\uC885\uBAA9 \uBE44\uC911\uC21C"
                                : "Weight",
                            },
                            {
                              value: "activity",
                              label: ko
                                ? "\uB9E4\uC218\uB9E4\uB3C4\uD070\uC21C"
                                : "Activity",
                            },
                            {
                              value: "value",
                              label: ko ? "\uD3C9\uAC00\uC561" : "Value",
                            },
                            {
                              value: "return",
                              label: ko ? "\uC218\uC775\uB960" : "Return",
                            },
                            {
                              value: "name",
                              label: ko ? "\uC885\uBAA9\uBA85" : "Name",
                            },
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
                          <option value="weight">
                            {ko ? "종목 비중순" : "Weight"}
                          </option>
                          <option value="activity">
                            {ko ? "매수매도큰순" : "Activity"}
                          </option>
                          <option value="value">
                            {ko ? "평가액" : "Value"}
                          </option>
                          <option value="return">
                            {ko ? "수익률" : "Return"}
                          </option>
                          <option value="name">{ko ? "종목명" : "Name"}</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setSortDirection((direction) =>
                              direction === "desc" ? "asc" : "desc",
                            );
                            setHoldingPage(1);
                          }}
                          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary"
                          aria-label={
                            sortDirection === "desc"
                              ? ko
                                ? "내림차순"
                                : "Descending"
                              : ko
                                ? "오름차순"
                                : "Ascending"
                          }
                        >
                          {sortDirection === "desc" ? (
                            <ArrowDown size={16} />
                          ) : (
                            <ArrowUp size={16} />
                          )}
                          {sortDirection === "desc"
                            ? ko
                              ? "내림차순"
                              : "Desc"
                            : ko
                              ? "오름차순"
                              : "Asc"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[minmax(180px,1fr)_repeat(3,minmax(130px,auto))]">
                      <input
                        value={holdingSearch}
                        onChange={(event) => {
                          setHoldingSearch(event.target.value);
                          setHoldingPage(1);
                        }}
                        placeholder={
                          ko
                            ? "티커·종목명·CUSIP 검색"
                            : "Search ticker, issuer, CUSIP"
                        }
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
                          <option key={sector} value={sector}>
                            {sector === "all"
                              ? ko
                                ? "전체 섹터"
                                : "All sectors"
                              : sectorLabel(sector, ko)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={holdingActivity}
                        onChange={(event) => {
                          setHoldingActivity(
                            event.target.value as HoldingActivityFilter,
                          );
                          setHoldingPage(1);
                        }}
                        className="h-10 min-w-0 w-full rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
                      >
                        <option value="all">
                          {ko ? "전체 매매" : "All activity"}
                        </option>
                        <option value="new">
                          {ko ? "신규매수" : "New buys"}
                        </option>
                        <option value="increased">
                          {ko ? "비중확대" : "Increased"}
                        </option>
                        <option value="reduced">
                          {ko ? "비중축소" : "Reduced"}
                        </option>
                        <option value="soldOut">
                          {ko ? "전량매도" : "Sold out"}
                        </option>
                      </select>
                      <select
                        value={holdingReturn}
                        onChange={(event) => {
                          setHoldingReturn(
                            event.target.value as HoldingReturnFilter,
                          );
                          setHoldingPage(1);
                        }}
                        className="h-10 min-w-0 w-full rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
                      >
                        <option value="all">
                          {ko ? "전체 수익률" : "All returns"}
                        </option>
                        <option value="positive">
                          {ko ? "플러스" : "Positive"}
                        </option>
                        <option value="negative">
                          {ko ? "마이너스" : "Negative"}
                        </option>
                        <option value="none">
                          {ko ? "수익률 없음" : "No return"}
                        </option>
                      </select>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {ko
                        ? `${sortedHoldings.length}개 표시 / 전체 ${tableHoldings.length}개`
                        : `${sortedHoldings.length} shown / ${tableHoldings.length} total`}
                    </p>
                    <div className="mt-4 grid gap-2 md:hidden">
                      {visibleHoldings.map((item) => (
                        <article
                          key={item.id}
                          className="min-w-0 rounded-md border border-border bg-surface p-3"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {holdingLabel(item)}
                                {item.putCall
                                  ? ` ${item.putCall.toUpperCase()}`
                                  : ""}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-muted">
                                {item.issuerName}
                              </p>
                            </div>
                            {isSoldOut(item) ? (
                              <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                                {ko ? "전량매도" : "Sold out"}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                            <div>
                              <p className="text-muted">
                                {ko ? "섹터" : "Sector"}
                              </p>
                              <p className="mt-0.5 truncate font-semibold">
                                {sectorLabel(item.sector, ko)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-muted">
                                {ko ? "평가액" : "Value"}
                              </p>
                              <p className="mt-0.5 font-semibold">
                                {formatMoney(item.value)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted">
                                {ko ? "현재 비중" : "Weight"}
                              </p>
                              <p className="mt-0.5 font-semibold">
                                {item.weight.toFixed(2)}%
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-muted">
                                {ko ? "비중 변화 / 수익률" : "Change / Return"}
                              </p>
                              <p className="mt-0.5 font-semibold">
                                <span
                                  className={
                                    item.weightChange >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  {formatPercent(item.weightChange)}
                                </span>{" "}
                                <span
                                  className={
                                    item.returnPercent === null
                                      ? "text-muted"
                                      : item.returnPercent >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                  }
                                >
                                  {item.returnPercent === null
                                    ? "-"
                                    : formatPercent(item.returnPercent)}
                                </span>
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                      {!visibleHoldings.length ? (
                        <div className="py-8 text-center text-sm font-semibold text-muted">
                          {ko
                            ? "조건에 맞는 보유종목이 없습니다."
                            : "No holdings match the current filters."}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[880px] text-left text-sm">
                        <thead className="border-b border-border text-xs text-muted">
                          <tr>
                            <th className="px-2 py-3">
                              {ko ? "\uC885\uBAA9" : "Holding"}
                            </th>
                            <th className="px-2 py-3">
                              {ko ? "\uC139\uD130" : "Sector"}
                            </th>
                            <th className="px-2 py-3 text-right">
                              {ko ? "\uBCF4\uC720\uB7C9" : "Shares"}
                            </th>
                            <th className="px-2 py-3 text-right">
                              {ko ? "\uD3C9\uAC00\uC561" : "Value"}
                            </th>
                            <th className="px-2 py-3 text-right">
                              {ko ? "\uD604\uC7AC \uBE44\uC911" : "Weight"}
                            </th>
                            <th className="px-2 py-3 text-right">
                              {ko ? "\uBE44\uC911 \uBCC0\uD654" : "Change"}
                            </th>
                            <th className="px-2 py-3 text-right">
                              {ko ? "\uC218\uC775\uB960" : "Return"}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {visibleHoldings.map((item) => (
                            <tr key={item.id} className="hover:bg-surface">
                              <td className="px-2 py-3">
                                <p className="font-semibold">
                                  {holdingLabel(item)}
                                  {item.putCall
                                    ? ` ${item.putCall.toUpperCase()}`
                                    : ""}
                                  {isSoldOut(item) ? (
                                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                                      {ko
                                        ? "\uC804\uB7C9\uB9E4\uB3C4"
                                        : "Sold out"}
                                    </span>
                                  ) : null}
                                </p>
                                <p className="max-w-72 truncate text-xs text-muted">
                                  {item.ticker ? item.issuerName : item.cusip}
                                </p>
                              </td>
                              <td className="px-2 py-3">
                                <p className="font-semibold">
                                  {sectorLabel(item.sector, ko)}
                                </p>
                                <p className="max-w-48 truncate text-xs text-muted">
                                  {item.industry ?? "-"}
                                </p>
                              </td>
                              <td className="px-2 py-3 text-right">
                                {number.format(item.shares)}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatMoney(item.value)}
                              </td>
                              <td className="px-2 py-3 text-right font-semibold">
                                {item.weight.toFixed(2)}%
                              </td>
                              <td
                                className={`px-2 py-3 text-right font-semibold ${item.weightChange >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {formatPercent(item.weightChange)}
                              </td>
                              <td
                                className={`px-2 py-3 text-right font-semibold ${item.returnPercent === null ? "text-muted" : item.returnPercent >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {item.returnPercent === null
                                  ? "-"
                                  : formatPercent(item.returnPercent)}
                              </td>
                            </tr>
                          ))}
                          {!visibleHoldings.length ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-2 py-8 text-center text-sm font-semibold text-muted"
                              >
                                {ko
                                  ? "조건에 맞는 보유종목이 없습니다."
                                  : "No holdings match the current filters."}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <button
                        type="button"
                        disabled={holdingPage <= 1}
                        onClick={() =>
                          setHoldingPage((page) => Math.max(1, page - 1))
                        }
                        className="cursor-pointer rounded-md border border-border px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {ko ? "\uC774\uC804" : "Previous"}
                      </button>
                      <span className="text-muted">
                        {holdingPage} / {holdingTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={holdingPage >= holdingTotalPages}
                        onClick={() =>
                          setHoldingPage((page) =>
                            Math.min(holdingTotalPages, page + 1),
                          )
                        }
                        className="cursor-pointer rounded-md border border-border px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {ko ? "다음" : "Next"}
                      </button>
                    </div>
                  </section>
                )}
              </section>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
