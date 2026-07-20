"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";

import { InfoHint } from "@/common/components/InfoHint";
import { SectionHeader } from "@/common/components/SectionHeader";
import { SegmentedControl } from "@/common/components/SegmentedControl";
import { ViewToggle } from "@/domain/calendar/components/ViewToggle";
import type { GuruConsensus, GuruSummary } from "@/domain/gurus/types";
import {
  type ConsensusSort,
  type ManagerSort,
  type RootTab,
  type SortDirection,
  formatGuruCardMoney,
  formatMoney,
  localizedQuarterLabel,
  number,
} from "@/domain/gurus/components/guruPortfolioUtils";

export function GuruRootContent({
  ko,
  rootTab,
  managers,
  sortedManagers,
  consensus,
  consensusSort,
  managerSort,
  managerDirection,
  onRootTabChange,
  onConsensusSortChange,
  onManagerSortChange,
  onManagerDirectionChange,
  onStockOpen,
}: {
  ko: boolean;
  rootTab: RootTab;
  managers: GuruSummary[];
  sortedManagers: GuruSummary[];
  consensus: GuruConsensus[];
  consensusSort: ConsensusSort;
  managerSort: ManagerSort;
  managerDirection: SortDirection;
  onRootTabChange: (tab: RootTab) => void;
  onConsensusSortChange: (sort: ConsensusSort) => void;
  onManagerSortChange: (sort: ManagerSort) => void;
  onManagerDirectionChange: () => void;
  onStockOpen: (ticker: string) => void;
}) {
  const rootTabs = (
    <SegmentedControl<RootTab>
      className="w-full sm:w-fit"
      value={rootTab}
      onChange={onRootTabChange}
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
              onChange={onManagerSortChange}
              options={[
                { value: "value", label: ko ? "13F 규모" : "13F value" },
                { value: "positions", label: ko ? "보유종목" : "Positions" },
              ]}
            />
            <div className="ml-auto inline-flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
              <button
                type="button"
                onClick={onManagerDirectionChange}
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
              onChange={onConsensusSortChange}
              options={[
                {
                  value: "totalValue",
                  label: ko ? "총 보유액" : "Total value",
                },
                {
                  value: "buyValue",
                  label: ko ? "매수 많은순" : "Most bought",
                },
                { value: "sellValue", label: ko ? "매도 많은순" : "Most sold" },
              ]}
            />
          </div>

          <div className="mt-4 grid gap-2 md:hidden">
            {consensus.map((item, index) => (
              <button
                key={item.ticker}
                onClick={() => onStockOpen(item.ticker)}
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
                    onClick={() => onStockOpen(item.ticker)}
                    className="cursor-pointer hover:bg-surface-muted"
                  >
                    <td className="py-3 font-bold text-primary">{index + 1}</td>
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
                      <span className="text-negative">{item.reducedCount}</span>
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
