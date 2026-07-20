"use client";

import type { ComponentType } from "react";

import type { GuruHolding } from "@/domain/gurus/types";

export type Metric = "weight" | "return";
export type DetailTab = "summary" | "holdings";
export type HoldingsView = "map" | "list";
export type HoldingSort = "weight" | "activity" | "value" | "return" | "name";
export type SortDirection = "desc" | "asc";
export type HoldingActivityFilter =
  | "all"
  | "new"
  | "increased"
  | "reduced"
  | "soldOut";
export type HoldingReturnFilter = "all" | "positive" | "negative" | "none";
export type ManagerSort = "value" | "positions";
export type RootTab = "managers" | "consensus";
export type ConsensusSort =
  | "totalValue"
  | "buyValue"
  | "sellValue"
  | "managerCount";

export type LayoutHolding = GuruHolding & {
  layoutValue?: number;
  isAggregate?: boolean;
  aggregateItems?: GuruHolding[];
};

export type Rect = {
  item: LayoutHolding;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SectorBlock = {
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

export const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function formatMoney(value: number): string {
  return `$${money.format(value)}`;
}

export function formatGuruCardMoney(value: number, ko: boolean): string {
  if (!ko) return formatMoney(value);
  const hundredMillions = value / 100_000_000;
  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: hundredMillions >= 100 ? 0 : 1,
  }).format(hundredMillions)}억 달러`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function isSoldOut(holding: GuruHolding): boolean {
  return holding.previousWeight > 0 && holding.weight <= 0;
}

export function holdingLabel(holding: GuruHolding): string {
  return holding.ticker ?? holding.issuerName;
}

export function mapHoldingLabel(holding: LayoutHolding, ko: boolean): string {
  if (holding.isAggregate) {
    const count = holding.aggregateItems?.length ?? 0;
    return ko
      ? `기타 ${number.format(count)}개`
      : `Other ${number.format(count)}`;
  }
  return holdingLabel(holding);
}

export function layoutTreemap(
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

export function tileColor(item: GuruHolding): string {
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

export function buildSectorBlocks(
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

export function sectorLabel(sector: string, ko: boolean): string {
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

export function localizedQuarterLabel(
  reportDate: string | null,
  ko: boolean,
): string {
  if (!reportDate) return "";
  const date = new Date(`${reportDate}T00:00:00Z`);
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return ko
    ? `${date.getUTCFullYear()}년 ${quarter}분기`
    : `${date.getUTCFullYear()} Q${quarter}`;
}

export function formatKstDateTime(value: string | null): string {
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

export function FreshnessBadge({
  value,
  ko,
}: {
  value: string | null;
  ko: boolean;
}) {
  const badge = freshnessBadge(value, ko);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

export function DetailInfoBlock({
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

export function HoldingRows({
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
