"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  LayoutGrid,
  List,
  RefreshCw,
  X,
} from "lucide-react";

import { InfoHint } from "@/common/components/InfoHint";
import { SegmentedControl } from "@/common/components/SegmentedControl";
import { ViewToggle } from "@/domain/calendar/components/ViewToggle";
import type { GuruDetail, GuruHolding } from "@/domain/gurus/types";
import {
  type HoldingActivityFilter,
  type HoldingReturnFilter,
  type HoldingsView,
  type HoldingSort,
  type LayoutHolding,
  type Metric,
  type SortDirection,
  buildSectorBlocks,
  formatMoney,
  formatPercent,
  holdingLabel,
  isSoldOut,
  layoutTreemap,
  localizedQuarterLabel,
  mapHoldingLabel,
  number,
  sectorLabel,
  tileColor,
} from "@/domain/gurus/components/guruPortfolioUtils";

const HOLDING_PAGE_SIZE = 10;

export function GuruHoldingsTab({
  detail,
  ko,
}: {
  detail: GuruDetail;
  ko: boolean;
}) {
  const [metric, setMetric] = useState<Metric>("weight");
  const [holdingsView, setHoldingsView] = useState<HoldingsView>("map");
  const [selectedMapGroup, setSelectedMapGroup] =
    useState<LayoutHolding | null>(null);
  const [holdingSort, setHoldingSort] = useState<HoldingSort>("weight");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [holdingSearch, setHoldingSearch] = useState("");
  const [holdingSector, setHoldingSector] = useState("all");
  const [holdingActivity, setHoldingActivity] =
    useState<HoldingActivityFilter>("all");
  const [holdingReturn, setHoldingReturn] =
    useState<HoldingReturnFilter>("all");
  const [holdingPage, setHoldingPage] = useState(1);

  const sectorBlocks = useMemo(
    () =>
      buildSectorBlocks(
        [...detail.holdings]
          .filter((holding) => holding.weight > 0)
          .sort((a, b) => b.weight - a.weight),
        metric,
      ),
    [detail.holdings, metric],
  );

  const mobileMapHoldings = useMemo(
    () =>
      [...detail.holdings]
        .filter((holding) => holding.weight > 0)
        .sort((a, b) =>
          metric === "weight"
            ? b.weight - a.weight
            : (b.returnPercent ?? Number.NEGATIVE_INFINITY) -
              (a.returnPercent ?? Number.NEGATIVE_INFINITY),
        ),
    [detail.holdings, metric],
  );

  const tableHoldings = useMemo(
    () => detail.activityHoldings ?? detail.holdings,
    [detail.activityHoldings, detail.holdings],
  );

  const holdingSectorOptions = useMemo(() => {
    const sectors = [
      ...new Set(
        tableHoldings.map((holding) => holding.sector).filter(Boolean),
      ),
    ].sort();
    return ["all", ...sectors];
  }, [tableHoldings]);

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
      ) {
        return false;
      }
      if (
        holdingActivity === "increased" &&
        !(
          holding.previousWeight > 0 &&
          holding.weight > 0 &&
          holding.shareChange > 0
        )
      ) {
        return false;
      }
      if (
        holdingActivity === "reduced" &&
        !(
          holding.previousWeight > 0 &&
          holding.weight > 0 &&
          holding.shareChange < 0
        )
      ) {
        return false;
      }
      if (holdingActivity === "soldOut" && !isSoldOut(holding)) return false;
      if (
        holdingReturn === "positive" &&
        !(holding.returnPercent !== null && holding.returnPercent >= 0)
      ) {
        return false;
      }
      if (
        holdingReturn === "negative" &&
        !(holding.returnPercent !== null && holding.returnPercent < 0)
      ) {
        return false;
      }
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

  const holdingTotalPages = Math.max(
    1,
    Math.ceil(sortedHoldings.length / HOLDING_PAGE_SIZE),
  );
  const visibleHoldings = sortedHoldings.slice(
    (holdingPage - 1) * HOLDING_PAGE_SIZE,
    holdingPage * HOLDING_PAGE_SIZE,
  );

  return (
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

      <section className="rounded-lg bg-surface-muted p-4 sm:p-5">
        {holdingsView === "map" ? (
          <MapView
            detail={detail}
            ko={ko}
            metric={metric}
            sectorBlocks={sectorBlocks}
            mobileMapHoldings={mobileMapHoldings}
            selectedMapGroup={selectedMapGroup}
            onMetricChange={(value) => {
              setSelectedMapGroup(null);
              setMetric(value);
            }}
            onMapGroupSelect={setSelectedMapGroup}
            onListOpen={(sector) => {
              setHoldingSector(sector);
              setHoldingPage(1);
              setHoldingsView("list");
            }}
          />
        ) : (
          <HoldingsListView
            ko={ko}
            tableHoldings={tableHoldings}
            sortedHoldings={sortedHoldings}
            visibleHoldings={visibleHoldings}
            holdingSectorOptions={holdingSectorOptions}
            holdingPage={holdingPage}
            holdingTotalPages={holdingTotalPages}
            holdingSort={holdingSort}
            sortDirection={sortDirection}
            holdingSearch={holdingSearch}
            holdingSector={holdingSector}
            holdingActivity={holdingActivity}
            holdingReturn={holdingReturn}
            setHoldingPage={setHoldingPage}
            setHoldingSort={setHoldingSort}
            setSortDirection={setSortDirection}
            setHoldingSearch={setHoldingSearch}
            setHoldingSector={setHoldingSector}
            setHoldingActivity={setHoldingActivity}
            setHoldingReturn={setHoldingReturn}
          />
        )}
      </section>
    </>
  );
}

function MapView({
  ko,
  metric,
  sectorBlocks,
  mobileMapHoldings,
  selectedMapGroup,
  onMetricChange,
  onMapGroupSelect,
  onListOpen,
}: {
  detail: GuruDetail;
  ko: boolean;
  metric: Metric;
  sectorBlocks: ReturnType<typeof buildSectorBlocks>;
  mobileMapHoldings: GuruHolding[];
  selectedMapGroup: LayoutHolding | null;
  onMetricChange: (metric: Metric) => void;
  onMapGroupSelect: (holding: LayoutHolding | null) => void;
  onListOpen: (sector: string) => void;
}) {
  if (!sectorBlocks.length) {
    return (
      <div className="mt-4 grid h-64 place-items-center rounded-lg bg-surface-muted text-sm text-muted">
        <RefreshCw size={18} className="mb-2" />
        {ko ? "최근 13F 보유종목 자료가 없습니다." : "No recent 13F holdings."}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ViewToggle<Metric>
          aria-label={ko ? "포트폴리오 맵 기준" : "Portfolio map metric"}
          value={metric}
          onChange={onMetricChange}
          options={[
            { value: "weight", label: ko ? "비중별" : "Weight" },
            { value: "return", label: ko ? "수익률별" : "Return" },
          ]}
        />
        <MapLegend metric={metric} ko={ko} />
      </div>

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
              <span className="truncate">{sectorLabel(block.sector, ko)}</span>
              <span>
                {block.items
                  .reduce((sum, item) => sum + item.weight, 0)
                  .toFixed(1)}
                %
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 top-6">
              {layoutTreemap(block.items).map(
                ({ item, x, y, width, height }) => (
                  <MapTile
                    key={item.id}
                    item={item}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    metric={metric}
                    ko={ko}
                    selected={selectedMapGroup?.id === item.id}
                    onAggregateSelect={onMapGroupSelect}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedMapGroup?.aggregateItems?.length ? (
        <AggregatePanel
          ko={ko}
          group={selectedMapGroup}
          onClose={() => onMapGroupSelect(null)}
          onListOpen={() => onListOpen(selectedMapGroup.sector)}
        />
      ) : null}
    </>
  );
}

function MapLegend({ metric, ko }: { metric: Metric; ko: boolean }) {
  return (
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
  );
}

function MapTile({
  item,
  x,
  y,
  width,
  height,
  metric,
  ko,
  selected,
  onAggregateSelect,
}: {
  item: LayoutHolding;
  x: number;
  y: number;
  width: number;
  height: number;
  metric: Metric;
  ko: boolean;
  selected: boolean;
  onAggregateSelect: (item: LayoutHolding) => void;
}) {
  const label =
    metric === "weight"
      ? `${item.weight.toFixed(2)}%`
      : item.returnPercent === null
        ? "-"
        : formatPercent(item.returnPercent);
  const displayLabel = mapHoldingLabel(item, ko);
  const content = (
    <div className="flex h-full flex-col items-center justify-center overflow-hidden p-1 text-center text-white drop-shadow-sm">
      {width > 8 && height > 8 ? (
        <strong className="max-w-full truncate text-[10px] sm:text-xs">
          {displayLabel}
          {item.putCall ? ` ${item.putCall.toUpperCase()}` : ""}
        </strong>
      ) : null}
      {width > 11 && height > 11 ? (
        <span className="mt-0.5 text-[9px] font-semibold sm:text-[11px]">
          {label}
        </span>
      ) : null}
    </div>
  );
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
    backgroundColor: item.isAggregate ? "rgb(71, 85, 105)" : tileColor(item),
  };
  const title = item.isAggregate
    ? `${displayLabel} \u00B7 ${sectorLabel(item.sector, ko)} \u00B7 ${item.weight.toFixed(2)}%`
    : `${item.issuerName} (${holdingLabel(item)}${item.putCall ? ` ${item.putCall.toUpperCase()}` : ""}) \u00B7 ${sectorLabel(item.sector, ko)} / ${item.industry ?? "-"} \u00B7 ${item.weight.toFixed(2)}% \u00B7 ${item.returnPercent === null ? "-" : formatPercent(item.returnPercent)}`;

  if (item.isAggregate) {
    return (
      <button
        type="button"
        onClick={() => onAggregateSelect(item)}
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
      href={`/?symbol=${encodeURIComponent(item.ticker)}&market=US`}
      className={className}
      style={style}
      title={title}
    >
      {content}
    </Link>
  ) : (
    <div className={className} style={style} title={title}>
      {content}
    </div>
  );
}

function AggregatePanel({
  ko,
  group,
  onClose,
  onListOpen,
}: {
  ko: boolean;
  group: LayoutHolding;
  onClose: () => void;
  onListOpen: () => void;
}) {
  const items = group.aggregateItems ?? [];

  return (
    <section className="mt-3 rounded-lg bg-surface p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted">
            {sectorLabel(group.sector, ko)}
          </p>
          <h4 className="mt-0.5 text-base font-bold">
            {mapHoldingLabel(group, ko)}
          </h4>
          <p className="mt-1 text-xs text-muted">
            {ko
              ? `${group.weight.toFixed(2)}% · ${formatMoney(group.value)} 규모의 소형 보유 종목을 묶었습니다.`
              : `${group.weight.toFixed(2)}% · ${formatMoney(group.value)} grouped smaller holdings.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onListOpen}
            className="h-8 cursor-pointer rounded-md bg-primary px-3 text-xs font-bold text-white transition hover:bg-primary/90"
          >
            {ko ? "목록에서 보기" : "View in list"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 cursor-pointer place-items-center rounded-md text-muted transition hover:bg-surface-subtle hover:text-foreground"
            aria-label={ko ? "닫기" : "Close"}
          >
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.slice(0, 12).map((item) => {
          const itemReturn =
            item.returnPercent === null
              ? "-"
              : formatPercent(item.returnPercent);
          const row = (
            <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-surface-muted px-3 py-2 text-sm transition hover:bg-surface-subtle">
              <div className="min-w-0">
                <p className="truncate font-semibold">{holdingLabel(item)}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {item.issuerName}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold">{item.weight.toFixed(2)}%</p>
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
      {items.length > 12 ? (
        <p className="mt-3 text-xs font-semibold text-muted">
          {ko
            ? `외 ${number.format(items.length - 12)}개 종목은 목록에서 확인할 수 있습니다.`
            : `${number.format(items.length - 12)} more holdings are available in the list view.`}
        </p>
      ) : null}
    </section>
  );
}

function HoldingsListView({
  ko,
  tableHoldings,
  sortedHoldings,
  visibleHoldings,
  holdingSectorOptions,
  holdingPage,
  holdingTotalPages,
  holdingSort,
  sortDirection,
  holdingSearch,
  holdingSector,
  holdingActivity,
  holdingReturn,
  setHoldingPage,
  setHoldingSort,
  setSortDirection,
  setHoldingSearch,
  setHoldingSector,
  setHoldingActivity,
  setHoldingReturn,
}: {
  ko: boolean;
  tableHoldings: GuruHolding[];
  sortedHoldings: GuruHolding[];
  visibleHoldings: GuruHolding[];
  holdingSectorOptions: string[];
  holdingPage: number;
  holdingTotalPages: number;
  holdingSort: HoldingSort;
  sortDirection: SortDirection;
  holdingSearch: string;
  holdingSector: string;
  holdingActivity: HoldingActivityFilter;
  holdingReturn: HoldingReturnFilter;
  setHoldingPage: (setter: number | ((page: number) => number)) => void;
  setHoldingSort: (sort: HoldingSort) => void;
  setSortDirection: (
    setter: SortDirection | ((direction: SortDirection) => SortDirection),
  ) => void;
  setHoldingSearch: (search: string) => void;
  setHoldingSector: (sector: string) => void;
  setHoldingActivity: (activity: HoldingActivityFilter) => void;
  setHoldingReturn: (returnFilter: HoldingReturnFilter) => void;
}) {
  return (
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
                label: ko ? "\uC885\uBAA9 \uBE44\uC911\uC21C" : "Weight",
              },
              {
                value: "activity",
                label: ko ? "\uB9E4\uC218\uB9E4\uB3C4\uD070\uC21C" : "Activity",
              },
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
            ko ? "티커·종목명·CUSIP 검색" : "Search ticker, issuer, CUSIP"
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
        {ko
          ? `${sortedHoldings.length}개 표시 / 전체 ${tableHoldings.length}개`
          : `${sortedHoldings.length} shown / ${tableHoldings.length} total`}
      </p>
      <HoldingsMobileList ko={ko} visibleHoldings={visibleHoldings} />
      <HoldingsTable ko={ko} visibleHoldings={visibleHoldings} />
      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          type="button"
          disabled={holdingPage <= 1}
          onClick={() => setHoldingPage((page) => Math.max(1, page - 1))}
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
            setHoldingPage((page) => Math.min(holdingTotalPages, page + 1))
          }
          className="cursor-pointer rounded-md border border-border px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ko ? "다음" : "Next"}
        </button>
      </div>
    </section>
  );
}

function HoldingsMobileList({
  ko,
  visibleHoldings,
}: {
  ko: boolean;
  visibleHoldings: GuruHolding[];
}) {
  return (
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
                {item.putCall ? ` ${item.putCall.toUpperCase()}` : ""}
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
              <p className="text-muted">{ko ? "섹터" : "Sector"}</p>
              <p className="mt-0.5 truncate font-semibold">
                {sectorLabel(item.sector, ko)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted">{ko ? "평가액" : "Value"}</p>
              <p className="mt-0.5 font-semibold">{formatMoney(item.value)}</p>
            </div>
            <div>
              <p className="text-muted">{ko ? "현재 비중" : "Weight"}</p>
              <p className="mt-0.5 font-semibold">{item.weight.toFixed(2)}%</p>
            </div>
            <div className="text-right">
              <p className="text-muted">
                {ko ? "비중 변화 / 수익률" : "Change / Return"}
              </p>
              <p className="mt-0.5 font-semibold">
                <span
                  className={
                    item.weightChange >= 0 ? "text-green-600" : "text-red-600"
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
  );
}

function HoldingsTable({
  ko,
  visibleHoldings,
}: {
  ko: boolean;
  visibleHoldings: GuruHolding[];
}) {
  return (
    <div className="mt-4 hidden overflow-x-auto md:block">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-border text-xs text-muted">
          <tr>
            <th className="px-2 py-3">{ko ? "\uC885\uBAA9" : "Holding"}</th>
            <th className="px-2 py-3">{ko ? "\uC139\uD130" : "Sector"}</th>
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
                  {item.putCall ? ` ${item.putCall.toUpperCase()}` : ""}
                  {isSoldOut(item) ? (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                      {ko ? "\uC804\uB7C9\uB9E4\uB3C4" : "Sold out"}
                    </span>
                  ) : null}
                </p>
                <p className="max-w-72 truncate text-xs text-muted">
                  {item.ticker ? item.issuerName : item.cusip}
                </p>
              </td>
              <td className="px-2 py-3">
                <p className="font-semibold">{sectorLabel(item.sector, ko)}</p>
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
  );
}
