"use client";

import { ListChecks, Percent, Repeat2 } from "lucide-react";

import type { GuruDetail, GuruHolding } from "@/domain/gurus/types";
import {
  DetailInfoBlock,
  formatMoney,
  formatPercent,
  formatGuruCardMoney,
  holdingLabel,
  HoldingRows,
  localizedQuarterLabel,
  number,
} from "@/domain/gurus/components/guruPortfolioUtils";

export function GuruSummaryTab({
  detail,
  ko,
}: {
  detail: GuruDetail;
  ko: boolean;
}) {
  const topHoldings = [...detail.holdings]
    .filter((holding) => holding.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  return (
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
                <p className="text-xs font-semibold text-muted">{item.label}</p>
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

      <TopHoldingsList holdings={topHoldings} ko={ko} />
    </>
  );
}

function TopHoldingsList({
  holdings,
  ko,
}: {
  holdings: GuruHolding[];
  ko: boolean;
}) {
  return (
    <section className="rounded-lg bg-surface-muted p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">
            {ko ? "보유종목 Top 10" : "Top 10 holdings"}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {ko
              ? "최근 13F 기준 현재 비중이 높은 종목입니다."
              : "Largest current positions from the latest 13F filing."}
          </p>
        </div>
        <p className="text-xs font-semibold text-muted">
          {ko ? "비중순" : "Sorted by weight"}
        </p>
      </div>

      {holdings.length ? (
        <>
          <div className="mt-4 grid gap-2 md:hidden">
            {holdings.map((item, index) => (
              <article
                key={item.id}
                className="rounded-md border border-border bg-surface p-3"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">
                      #{index + 1}
                    </p>
                    <p className="mt-1 truncate font-semibold">
                      {holdingLabel(item)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {item.issuerName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-foreground">
                      {item.weight.toFixed(2)}%
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {formatMoney(item.value)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th className="px-2 py-3">{ko ? "순위" : "Rank"}</th>
                  <th className="px-2 py-3">{ko ? "종목" : "Holding"}</th>
                  <th className="px-2 py-3 text-right">
                    {ko ? "보유량" : "Shares"}
                  </th>
                  <th className="px-2 py-3 text-right">
                    {ko ? "평가액" : "Value"}
                  </th>
                  <th className="px-2 py-3 text-right">
                    {ko ? "비중" : "Weight"}
                  </th>
                  <th className="px-2 py-3 text-right">
                    {ko ? "비중 변화" : "Change"}
                  </th>
                  <th className="px-2 py-3 text-right">
                    {ko ? "수익률" : "Return"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holdings.map((item, index) => (
                  <tr key={item.id} className="hover:bg-surface">
                    <td className="px-2 py-3 font-semibold text-primary">
                      #{index + 1}
                    </td>
                    <td className="px-2 py-3">
                      <p className="font-semibold">
                        {holdingLabel(item)}
                        {item.putCall
                          ? ` ${item.putCall.toUpperCase()}`
                          : ""}
                      </p>
                      <p className="max-w-72 truncate text-xs text-muted">
                        {item.issuerName}
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
                      className={`px-2 py-3 text-right font-semibold ${
                        item.weightChange >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatPercent(item.weightChange)}
                    </td>
                    <td
                      className={`px-2 py-3 text-right font-semibold ${
                        item.returnPercent === null
                          ? "text-muted"
                          : item.returnPercent >= 0
                            ? "text-green-600"
                            : "text-red-600"
                      }`}
                    >
                      {item.returnPercent === null
                        ? "-"
                        : formatPercent(item.returnPercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-md border border-border bg-surface px-3 py-8 text-center text-sm font-semibold text-muted">
          {ko ? "보유종목 데이터가 없습니다." : "No holdings available."}
        </p>
      )}
    </section>
  );
}
