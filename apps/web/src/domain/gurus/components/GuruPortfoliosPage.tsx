"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { Skeleton } from "@/common/components/Skeleton";
import { apiRequest } from "@/common/lib/api";
import { usePreferencesStore } from "@/common/stores/preferences";
import { useSessionStore } from "@/common/stores/session";
import { GuruHoldingsTab } from "@/domain/gurus/components/GuruHoldingsTab";
import { GuruRootContent } from "@/domain/gurus/components/GuruRootContent";
import { GuruSummaryTab } from "@/domain/gurus/components/GuruSummaryTab";
import type {
  GuruDetail,
  GuruConsensus,
  GuruSummary,
} from "@/domain/gurus/types";
import {
  type ConsensusSort,
  type DetailTab,
  type ManagerSort,
  type RootTab,
  type SortDirection,
  formatKstDateTime,
  FreshnessBadge,
  localizedQuarterLabel,
} from "@/domain/gurus/components/guruPortfolioUtils";

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
  const [detailTab, setDetailTab] = useState<DetailTab>(initialTab);
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
    return (
      <GuruRootContent
        ko={ko}
        rootTab={rootTab}
        managers={managers}
        sortedManagers={sortedManagers}
        consensus={consensus}
        consensusSort={consensusSort}
        managerSort={managerSort}
        managerDirection={managerDirection}
        onRootTabChange={(tab) => {
          setRootTab(tab);
          router.push(tab === "consensus" ? "/gurus/trading" : "/gurus");
        }}
        onConsensusSortChange={setConsensusSort}
        onManagerSortChange={setManagerSort}
        onManagerDirectionChange={() =>
          setManagerDirection((value) => (value === "desc" ? "asc" : "desc"))
        }
        onStockOpen={(ticker) =>
          router.push(
            `/?symbol=${encodeURIComponent(ticker)}&market=US&currency=USD`,
          )
        }
      />
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
            <GuruSummaryTab detail={detail} ko={ko} />
          ) : null}

          {detailTab === "holdings" ? (
            <GuruHoldingsTab detail={detail} ko={ko} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
