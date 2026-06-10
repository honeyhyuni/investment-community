"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/common/components/Notice";
import { apiRequest } from "@/common/lib/api";
import { useSessionStore } from "@/common/stores/session";
import { BriefingMarket, MarketBriefing } from "@/domain/market-briefing/types";

const briefingTabs: Array<{ id: BriefingMarket; label: string; caption: string }> = [
  { id: "KR", label: "한국시황", caption: "오늘장 주식 요약" },
  { id: "US", label: "미국시황", caption: "전날 미국장 요약" },
];

const pageSize = 10;
const oneDayMs = 24 * 60 * 60 * 1000;
const changePattern = /\(([+-]?\d+(?:\.\d+)?%)\)/;

export function MarketBriefingPage({
  briefingId,
}: {
  briefingId?: string;
} = {}) {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const [market, setMarket] = useState<BriefingMarket>("KR");
  const [briefings, setBriefings] = useState<MarketBriefing[]>([]);
  const [detailBriefing, setDetailBriefing] = useState<MarketBriefing | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedBriefing = useMemo(
    () =>
      detailBriefing ??
      briefings.find((briefing) => briefing.id === selectedId) ??
      null,
    [briefings, detailBriefing, selectedId],
  );
  const totalPages = Math.max(1, Math.ceil(briefings.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleBriefings = briefings.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const isAdmin = user?.role === "ADMIN";

  const applyBriefing = useCallback((nextBriefing: MarketBriefing) => {
    setDetailBriefing(nextBriefing);
    setSelectedId(nextBriefing.id);
    setMarket(nextBriefing.market);
    setBriefings((items) =>
      items.map((item) => (item.id === nextBriefing.id ? nextBriefing : item)),
    );
  }, []);

  const loadBriefings = useCallback(
    async (token = accessToken, nextMarket: BriefingMarket = market) => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError("");
      try {
        const nextBriefings = await apiRequest<MarketBriefing[]>(
          `/markets/briefings?market=${nextMarket}`,
          "GET",
          { accessToken: token },
        );
        setBriefings(nextBriefings);
        if (!briefingId) {
          setSelectedId(null);
          setDetailBriefing(null);
        }
        setPage(1);
      } catch (briefingError) {
        setBriefings([]);
        setSelectedId(null);
        setError(
          briefingError instanceof Error
            ? briefingError.message
            : "마켓 브리핑을 불러오지 못했습니다.",
        );
      } finally {
        setLoading(false);
      }
    },
    [accessToken, briefingId, market],
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void loadBriefings(accessToken, market);
  }, [accessToken, market, loadBriefings]);

  useEffect(() => {
    if (!accessToken || !briefingId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    apiRequest<MarketBriefing>(`/markets/briefings/${briefingId}`, "GET", {
      accessToken,
    })
      .then((briefing) => {
        if (cancelled) {
          return;
        }
        setDetailBriefing(briefing);
        setSelectedId(briefing.id);
        setMarket(briefing.market);
      })
      .catch((briefingError) => {
        if (cancelled) {
          return;
        }
        setDetailBriefing(null);
        setSelectedId(null);
        setError(
          briefingError instanceof Error
            ? briefingError.message
            : "마켓 브리핑을 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, briefingId]);

  return (
    <>
      {error ? <Notice message="" error={error} /> : null}

      <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[1fr]">
        <section className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#607086]">
                AI Market Briefing
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-[#17202e]">
                마켓 브리핑
              </h2>
            </div>
            <span className="rounded-md bg-[#eef3f8] px-2.5 py-1 text-sm font-semibold text-[#344052]">
              {briefings.length}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {briefingTabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setMarket(item.id)}
                className={`cursor-pointer rounded-md px-3 py-2 text-base font-semibold transition-colors ${
                  market === item.id
                    ? "bg-[#1f6f8b] text-white"
                    : "border border-[#c7ceda] bg-white text-[#344052] hover:bg-[#eef1f6]"
                }`}
              >
                {item.label}
                <span className="ml-2 text-xs font-medium opacity-80">
                  {item.caption}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            {selectedBriefing ? (
              <BriefingDetail
                briefing={selectedBriefing}
                accessToken={accessToken}
                isAdmin={isAdmin}
                onSaved={applyBriefing}
                onDeleted={(deletedId) => {
                  setBriefings((items) => items.filter((item) => item.id !== deletedId));
                  setSelectedId(null);
                  setDetailBriefing(null);
                  router.push("/market-briefing");
                }}
                onBack={() => {
                  setSelectedId(null);
                  setDetailBriefing(null);
                  router.push("/market-briefing");
                }}
              />
            ) : (
              <BriefingList
                briefings={visibleBriefings}
                loading={loading}
                page={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
                onSelect={(nextId) => router.push(`/market-briefing/${nextId}`)}
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function BriefingList({
  briefings,
  loading,
  page,
  totalPages,
  onPageChange,
  onSelect,
}: {
  briefings: MarketBriefing[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
}) {
  if (loading && briefings.length === 0) {
    return (
      <p className="rounded-md border border-[#d9dee8] p-6 text-center text-base text-[#607086]">
        마켓 브리핑을 불러오는 중입니다.
      </p>
    );
  }

  if (!briefings.length) {
    return (
      <p className="rounded-md border border-[#d9dee8] p-6 text-center text-base text-[#607086]">
        표시할 마켓 브리핑이 없습니다.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-3">
        {briefings.map((briefing) => (
          <button
            key={briefing.id}
            onClick={() => onSelect(briefing.id)}
            className="block cursor-pointer rounded-md border border-[#d9dee8] p-4 text-left transition-colors hover:bg-[#f6f8fb]"
          >
            <p className="text-sm font-semibold text-[#607086]">
              {briefing.market === "KR" ? "한국시황" : "미국시황"} ·{" "}
              {new Date(briefing.generatedAt * 1000).toLocaleString("ko-KR")}
            </p>
            <h3 className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold text-[#17202e]">
              <span>{briefing.title}</span>
              {isNewBriefing(briefing) ? (
                <span className="rounded bg-[#e73843] px-1.5 py-0.5 text-xs font-bold text-white">
                  N
                </span>
              ) : null}
            </h3>
            <p className="mt-2 line-clamp-1 text-base leading-7 text-[#607086]">
              {briefing.summaryLines[0] ?? briefing.summary}
            </p>
          </button>
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between border-t border-[#eef1f6] pt-4">
          <button
            disabled={page === 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="h-10 cursor-pointer rounded-md border border-[#c7ceda] px-4 text-base font-semibold disabled:cursor-default disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-base font-medium text-[#607086]">
            {page} / {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className="h-10 cursor-pointer rounded-md border border-[#c7ceda] px-4 text-base font-semibold disabled:cursor-default disabled:opacity-50"
          >
            다음
          </button>
        </div>
      ) : null}
    </>
  );
}

function BriefingDetail({
  briefing,
  accessToken,
  isAdmin,
  onSaved,
  onDeleted,
  onBack,
}: {
  briefing: MarketBriefing;
  accessToken: string | null;
  isAdmin: boolean;
  onSaved: (briefing: MarketBriefing) => void;
  onDeleted: (id: string) => void;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [formError, setFormError] = useState("");

  const handleDelete = async () => {
    if (!accessToken || deletePending) {
      return;
    }
    if (!window.confirm("이 마켓 브리핑을 삭제할까요?")) {
      return;
    }

    setDeletePending(true);
    setFormError("");
    try {
      await apiRequest<{ ok: true }>(`/markets/briefings/${briefing.id}`, "DELETE", {
        accessToken,
      });
      onDeleted(briefing.id);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <article className="rounded-md border border-[#d9dee8] bg-[#f9fafc] p-5">
      <button
        onClick={onBack}
        className="mb-4 h-10 cursor-pointer rounded-md border border-[#c7ceda] bg-white px-4 text-base font-semibold text-[#344052] hover:bg-[#eef1f6]"
      >
        목록으로
      </button>

      {isAdmin ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditing((value) => !value);
              setFormError("");
            }}
            className="h-10 cursor-pointer rounded-md border border-[#1f6f8b] bg-white px-4 text-base font-semibold text-[#1f6f8b] hover:bg-[#eef6f9]"
          >
            {editing ? "수정 취소" : "수정"}
          </button>
          <button
            disabled={deletePending}
            onClick={handleDelete}
            className="h-10 cursor-pointer rounded-md border border-[#d74848] bg-white px-4 text-base font-semibold text-[#c43232] hover:bg-[#fff1f1] disabled:cursor-default disabled:opacity-50"
          >
            {deletePending ? "삭제 중" : "삭제"}
          </button>
        </div>
      ) : null}

      {formError ? <Notice message="" error={formError} /> : null}

      {editing ? (
        <BriefingEditForm
          briefing={briefing}
          accessToken={accessToken}
          saving={saving}
          setSaving={setSaving}
          onCancel={() => setEditing(false)}
          onSaved={(nextBriefing) => {
            onSaved(nextBriefing);
            setEditing(false);
          }}
          onError={setFormError}
        />
      ) : null}

      {briefing.imageUrl ? (
        <div className="mb-6 overflow-hidden rounded-md border border-[#d9dee8] bg-[#101722]">
          <img
            src={briefing.imageUrl}
            alt=""
            className="mx-auto max-h-[460px] w-full object-contain"
          />
        </div>
      ) : null}

      <div className="border-b border-[#d9dee8] pb-5">
        <p className="text-sm font-semibold text-[#607086]">
          {briefing.market === "KR" ? "한국시황" : "미국시황"} ·{" "}
          {briefing.market === "KR" ? "오늘장 주식 요약" : "전날 미국장 요약"}
        </p>
        <h3 className="mt-2 text-3xl font-semibold leading-tight text-[#17202e]">
          {briefing.title}
        </h3>
        <p className="mt-2 text-sm font-medium text-[#607086]">
          {new Date(briefing.generatedAt * 1000).toLocaleString("ko-KR")}
        </p>
      </div>

      <section className="mt-6 space-y-4 rounded-md border border-[#d9dee8] bg-white p-5">
        <h4 className="text-lg font-semibold text-[#17202e]">시장 전체 요약</h4>
        <div className="space-y-5 text-base leading-8 text-[#344052]">
          {(briefing.summaryLines ?? []).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      {(briefing.macroLines ?? []).length ? (
        <section className="mt-5 space-y-4 rounded-md border border-[#d9dee8] bg-white p-5">
          <h4 className="text-lg font-semibold text-[#17202e]">매크로 점검</h4>
          <div className="space-y-5 text-base leading-8 text-[#344052]">
            {(briefing.macroLines ?? []).map((line, index) => (
              <p key={`${index}-${line}`}>{line}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-5 space-y-4 rounded-md border border-[#d9dee8] bg-white p-5">
        <h4 className="text-lg font-semibold text-[#17202e]">
          주요 종목/기업 뉴스
        </h4>
        <div className="grid gap-4">
          {(briefing.companyNews ?? []).map((item, index) => {
            const ticker = briefingCompanyTicker(item);
            const change = briefingCompanyChange(item);
            const companyName = briefingCompanyName(item, ticker);
            const lines =
              Array.isArray(item.lines) && item.lines.length
                ? item.lines
                : item.headline
                  ? [item.headline]
                  : [];
            const headline = cleanCompanyHeadline(item.headline, companyName, ticker);
            return (
              <div
                key={`${ticker || item.symbol || "symbol"}-${item.headline ?? "headline"}-${index}`}
                className="border-b border-[#eef1f6] pb-4 last:border-0 last:pb-0"
              >
                <h5 className="text-base font-semibold text-[#17202e]">
                  {companyName || item.symbol || "종목/기업"}{" "}
                  {ticker ? (
                    <a
                      href={stockHref(ticker, briefing.market)}
                      className="cursor-pointer text-[#1f6f8b] underline-offset-2 hover:underline"
                    >
                      #{ticker}
                    </a>
                  ) : null}
                  {change ? (
                    <span
                      className={`ml-1 font-semibold ${
                        change.startsWith("-") ? "text-[#d74848]" : "text-[#178447]"
                      }`}
                    >
                      ({change})
                    </span>
                  ) : null}
                </h5>
                {headline && lines[0] !== item.headline ? (
                  <p className="mt-1 text-base font-medium text-[#344052]">
                    {headline}
                  </p>
                ) : null}
                <div className="mt-3 space-y-4 text-base leading-8 text-[#607086]">
                  {lines.map((line, lineIndex) => (
                    <p key={`${lineIndex}-${line}`}>{line}</p>
                  ))}
                </div>
              </div>
            );
          })}
          {!(briefing.companyNews ?? []).length ? (
            <p className="text-base leading-8 text-[#607086]">
              표시할 주요 종목/기업 뉴스가 없습니다.
            </p>
          ) : null}
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-[#d9dee8] bg-white p-5">
          <h4 className="text-lg font-semibold text-[#17202e]">
            오늘의 핵심 키워드
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {(briefing.keywords ?? []).map((keyword) => (
              <span
                key={keyword}
                className="rounded-md bg-[#eef6f9] px-2.5 py-1 text-sm font-semibold text-[#1f6f8b]"
              >
                {keyword}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-[#d9dee8] bg-white p-5">
          <h4 className="text-lg font-semibold text-[#17202e]">
            단기 관전 포인트
          </h4>
          <div className="mt-3 space-y-4 text-base leading-8 text-[#344052]">
            {(briefing.watchPoints ?? []).map((point) => (
              <p key={point}>{point}</p>
            ))}
          </div>
        </section>
      </div>

      {briefing.sources?.length ? (
        <section className="mt-5 rounded-md border border-[#d9dee8] bg-white p-5">
          <h4 className="text-lg font-semibold text-[#17202e]">참고 뉴스</h4>
          <div className="mt-3 grid gap-2">
            {briefing.sources.map((item) => (
              <a
                key={`${item.source}-${item.url}`}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block cursor-pointer rounded-md border border-[#eef1f6] px-3 py-2 text-base hover:bg-[#f6f8fb]"
              >
                <span className="font-semibold text-[#344052]">
                  {item.headline}
                </span>
                <span className="ml-2 text-sm text-[#607086]">
                  {item.source} ·{" "}
                  {new Date(item.datetime * 1000).toLocaleDateString("ko-KR")}
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function BriefingEditForm({
  briefing,
  accessToken,
  saving,
  setSaving,
  onCancel,
  onSaved,
  onError,
}: {
  briefing: MarketBriefing;
  accessToken: string | null;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onCancel: () => void;
  onSaved: (briefing: MarketBriefing) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(briefing.title);
  const [summaryLines, setSummaryLines] = useState(linesToText(briefing.summaryLines));
  const [macroLines, setMacroLines] = useState(linesToText(briefing.macroLines ?? []));
  const [companyNews, setCompanyNews] = useState(
    JSON.stringify(briefing.companyNews ?? [], null, 2),
  );
  const [keywords, setKeywords] = useState((briefing.keywords ?? []).join(", "));
  const [watchPoints, setWatchPoints] = useState(linesToText(briefing.watchPoints));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || saving) {
      return;
    }

    let parsedCompanyNews: MarketBriefing["companyNews"];
    try {
      parsedCompanyNews = JSON.parse(companyNews) as MarketBriefing["companyNews"];
      if (!Array.isArray(parsedCompanyNews)) {
        throw new Error("companyNews must be an array.");
      }
    } catch {
      onError("종목/기업 뉴스 JSON 형식이 올바르지 않습니다.");
      return;
    }

    setSaving(true);
    onError("");
    try {
      const updated = await apiRequest<MarketBriefing>(
        `/markets/briefings/${briefing.id}`,
        "PATCH",
        {
          accessToken,
          body: {
            title,
            summaryLines: textToLines(summaryLines),
            macroLines: textToLines(macroLines),
            companyNews: parsedCompanyNews,
            keywords: keywords
              .split(/[,\n]/)
              .map((keyword) => keyword.trim())
              .filter(Boolean),
            watchPoints: textToLines(watchPoints),
          },
        },
      );
      onSaved(updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid gap-4 rounded-md border border-[#c7d6df] bg-white p-4"
    >
      <label className="grid gap-1 text-sm font-semibold text-[#344052]">
        제목
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-11 rounded-md border border-[#c7ceda] px-3 text-base font-medium"
        />
      </label>
      <EditTextarea label="시장 전체 요약" value={summaryLines} onChange={setSummaryLines} />
      <EditTextarea label="매크로 점검" value={macroLines} onChange={setMacroLines} />
      <EditTextarea
        label="주요 종목/기업 뉴스 JSON"
        value={companyNews}
        onChange={setCompanyNews}
        minHeight="260px"
      />
      <EditTextarea label="핵심 키워드" value={keywords} onChange={setKeywords} />
      <EditTextarea label="단기 관전 포인트" value={watchPoints} onChange={setWatchPoints} />
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 cursor-pointer rounded-md border border-[#c7ceda] px-4 text-base font-semibold hover:bg-[#eef1f6]"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={saving}
          className="h-10 cursor-pointer rounded-md bg-[#1f6f8b] px-4 text-base font-semibold text-white hover:bg-[#185970] disabled:cursor-default disabled:opacity-50"
        >
          {saving ? "저장 중" : "저장"}
        </button>
      </div>
    </form>
  );
}

function EditTextarea({
  label,
  value,
  onChange,
  minHeight = "150px",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-[#344052]">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ minHeight }}
        className="resize-y rounded-md border border-[#c7ceda] px-3 py-2 text-base font-medium leading-7"
      />
    </label>
  );
}

function linesToText(value: string[] | undefined): string {
  return (value ?? []).join("\n");
}

function textToLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isNewBriefing(briefing: MarketBriefing): boolean {
  return Date.now() - briefing.generatedAt * 1000 <= oneDayMs;
}

function briefingCompanyTicker(
  item: MarketBriefing["companyNews"][number],
): string {
  const explicitSymbol = extractTickerTag(item.symbol);
  if (explicitSymbol) {
    return explicitSymbol;
  }

  return extractTickerTag(
    [item.name, item.headline, ...(item.lines ?? [])].filter(Boolean).join(" "),
  );
}

function briefingCompanyName(
  item: MarketBriefing["companyNews"][number],
  ticker: string,
): string {
  const source = item.name || item.headline || item.symbol || "";
  const escapedTicker = escapeRegExp(ticker);
  if (!item.name && escapedTicker) {
    const prefix = source.match(new RegExp(`^(.+?)\\s*#${escapedTicker}\\b`, "i"))?.[1];
    if (prefix?.trim()) {
      return prefix.trim();
    }
  }

  return stripTickerTags(source, ticker)
    .replace(changePattern, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[,\s]+$/g, "")
    .trim();
}

function briefingCompanyChange(item: MarketBriefing["companyNews"][number]): string {
  const source = [item.name, item.headline, ...(item.lines ?? [])]
    .filter(Boolean)
    .join(" ");
  return source.match(changePattern)?.[1] ?? "";
}

function cleanCompanyHeadline(
  headline: string | undefined,
  companyName: string,
  ticker: string,
): string {
  let nextHeadline = (headline ?? "").trim();
  if (!nextHeadline) {
    return "";
  }

  const escapedName = escapeRegExp(companyName);
  const escapedTicker = escapeRegExp(ticker);
  if (escapedName && escapedTicker) {
    nextHeadline = nextHeadline.replace(
      new RegExp(`^${escapedName}\\s*(?:#${escapedTicker})?(?:\\s+#${escapedTicker})*\\s*(?:\\([+-]?\\d+(?:\\.\\d+)?%\\))?\\s*[,，:-]?\\s*`, "i"),
      "",
    );
  }

  if (escapedTicker) {
    nextHeadline = nextHeadline.replace(
      new RegExp(`^#${escapedTicker}\\s*(?:\\([+-]?\\d+(?:\\.\\d+)?%\\))?\\s*[,，:-]?\\s*`, "i"),
      "",
    );
  }

  return nextHeadline.replace(changePattern, "").trim();
}

function stripTickerTags(value: string, ticker: string): string {
  const escapedTicker = escapeRegExp(ticker);
  if (!escapedTicker) {
    return value.replace(/#[A-Z0-9.]{1,12}|#\d{6}/gi, "").trim();
  }

  return value
    .replace(new RegExp(`#${escapedTicker}\\b`, "gi"), "")
    .replace(/#[A-Z0-9.]{1,12}|#\d{6}/gi, "")
    .trim();
}

function extractTickerTag(value: string | undefined): string {
  const text = (value ?? "").trim();
  if (!text) {
    return "";
  }

  const tagged = text.match(/#([A-Z0-9.]{1,12}|\d{6})/i)?.[1];
  if (tagged) {
    return tagged.toUpperCase();
  }

  const clean = text.replace(/^#/, "").trim().toUpperCase();
  return /^[A-Z0-9.]{1,12}$/.test(clean) || /^\d{6}$/.test(clean) ? clean : "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stockHref(symbol: string, fallbackMarket: BriefingMarket): string {
  const cleanSymbol = extractTickerTag(symbol);
  const market = /^\d{6}$/.test(cleanSymbol) ? "KR" : fallbackMarket;
  return `/?symbol=${encodeURIComponent(cleanSymbol)}&market=${market}`;
}
