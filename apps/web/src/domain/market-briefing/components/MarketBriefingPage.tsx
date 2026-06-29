'use client';

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Notice } from '@/common/components/Notice';
import { Button } from '@/common/components/Button';
import { SegmentedControl } from '@/common/components/SegmentedControl';
import { Skeleton } from '@/common/components/Skeleton';
import { apiRequest } from '@/common/lib/api';
import { useSessionStore } from '@/common/stores/session';
import { usePreferencesStore } from '@/common/stores/preferences';
import { BriefingMarket, MarketBriefing } from '@/domain/market-briefing/types';

type Lang = 'ko' | 'en';

const briefingTabs: Array<{
  id: BriefingMarket;
  label: Record<Lang, string>;
  caption: Record<Lang, string>;
}> = [
  {
    id: 'KR',
    label: { ko: '한국시황', en: 'KR Market' },
    caption: { ko: '오늘장 주식 요약', en: "Today's session" },
  },
  {
    id: 'US',
    label: { ko: '미국시황', en: 'US Market' },
    caption: { ko: '전날 미국장 요약', en: 'Prev. US session' },
  },
];

// 시장 이름(리스트 카드·상세 헤더에서 공유).
function marketLabel(market: BriefingMarket, ko: boolean): string {
  if (market === 'KR') {
    return ko ? '한국시황' : 'KR Market';
  }
  return ko ? '미국시황' : 'US Market';
}

function marketCaption(market: BriefingMarket, ko: boolean): string {
  if (market === 'KR') {
    return ko ? '오늘장 주식 요약' : "Today's session recap";
  }
  return ko ? '전날 미국장 요약' : 'Previous US session recap';
}

const pageSize = 10;
const oneDayMs = 24 * 60 * 60 * 1000;
const changePattern = /\(([+-]\s*\d+(?:\.\d+)?%[^)]*)\)/;

export function MarketBriefingPage({
  briefingId,
}: {
  briefingId?: string;
} = {}) {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const ko = usePreferencesStore((s) => s.language) === 'ko';
  const lang: Lang = ko ? 'ko' : 'en';
  const [market, setMarket] = useState<BriefingMarket>('KR');
  const [briefings, setBriefings] = useState<MarketBriefing[]>([]);
  const [detailBriefing, setDetailBriefing] = useState<MarketBriefing | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
  const isAdmin = user?.role === 'ADMIN';

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
      setError('');
      try {
        const nextBriefings = await apiRequest<MarketBriefing[]>(
          `/markets/briefings?market=${nextMarket}`,
          'GET',
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
            : ko
              ? '마켓 브리핑을 불러오지 못했습니다.'
              : 'Could not load market briefings.',
        );
      } finally {
        setLoading(false);
      }
    },
    [accessToken, briefingId, market, ko],
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
    setError('');
    apiRequest<MarketBriefing>(`/markets/briefings/${briefingId}`, 'GET', {
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
            : ko
              ? '마켓 브리핑을 불러오지 못했습니다.'
              : 'Could not load market briefings.',
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
  }, [accessToken, briefingId, ko]);

  return (
    <>
      {error ? <Notice message="" error={error} /> : null}

      <div className="grid flex-1 gap-4 py-4 sm:gap-6 sm:py-6 lg:grid-cols-[1fr]">
        <section className="min-w-0">
          <SegmentedControl
            className="w-full sm:inline-flex sm:w-auto"
            aria-label={ko ? '시황 시장 선택' : 'Briefing market'}
            options={briefingTabs.map((item) => ({
              value: item.id,
              label: (
                <span className="flex flex-col items-center leading-tight">
                  <span>{item.label[lang]}</span>
                  <span className="text-[11px] font-medium opacity-80">
                    {item.caption[lang]}
                  </span>
                </span>
              ),
            }))}
            value={market}
            onChange={setMarket}
          />

          <div className="mt-4">
            {selectedBriefing ? (
              <BriefingDetail
                briefing={selectedBriefing}
                accessToken={accessToken}
                isAdmin={isAdmin}
                ko={ko}
                onSaved={applyBriefing}
                onDeleted={(deletedId) => {
                  setBriefings((items) =>
                    items.filter((item) => item.id !== deletedId),
                  );
                  setSelectedId(null);
                  setDetailBriefing(null);
                  router.push('/market-briefing');
                }}
                onBack={() => {
                  setSelectedId(null);
                  setDetailBriefing(null);
                  router.push('/market-briefing');
                }}
              />
            ) : (
              <BriefingList
                briefings={visibleBriefings}
                loading={loading}
                page={safePage}
                totalPages={totalPages}
                ko={ko}
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
  ko,
  onPageChange,
  onSelect,
}: {
  briefings: MarketBriefing[];
  loading: boolean;
  page: number;
  totalPages: number;
  ko: boolean;
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
}) {
  if (loading && briefings.length === 0) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <BriefingCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (!briefings.length) {
    return (
      <p className="rounded-md border border-border p-6 text-center text-base text-muted">
        {ko ? '표시할 마켓 브리핑이 없습니다.' : 'No market briefings to show.'}
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
            className="block cursor-pointer rounded-md border border-border bg-surface p-3 text-left shadow-sm transition-all duration-150 ease-out will-change-transform hover:scale-[1.01] hover:bg-surface-muted hover:shadow-md sm:p-4"
          >
            <p className="text-xs font-semibold text-muted sm:text-sm">
              {marketLabel(briefing.market, ko)} ·{' '}
              {new Date(briefing.generatedAt * 1000).toLocaleString(
                ko ? 'ko-KR' : 'en-US',
              )}
            </p>
            <h3 className="mt-1 flex flex-wrap items-center gap-2 text-base font-semibold leading-6 text-foreground sm:text-lg">
              <span>{briefing.title}</span>
              {isNewBriefing(briefing) ? (
                <span className="rounded bg-primary px-1.5 py-0.5 text-xs font-bold text-on-primary">
                  N
                </span>
              ) : null}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted sm:line-clamp-1 sm:text-base sm:leading-7">
              {briefing.summaryLines[0] ?? briefing.summary}
            </p>
          </button>
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ChevronLeft />}
            disabled={page === 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            {ko ? '이전' : 'Previous'}
          </Button>
          <span className="text-sm font-medium text-muted sm:text-base">
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            rightIcon={<ChevronRight />}
            disabled={page === totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            {ko ? '다음' : 'Next'}
          </Button>
        </div>
      ) : null}
    </>
  );
}

// 리스트 항목(메타 1줄 + 제목 + 요약 1줄)과 같은 레이아웃의 로딩 스켈레톤.
function BriefingCardSkeleton() {
  return (
    <div className="rounded-md border border-border bg-surface p-3 shadow-sm sm:p-4">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-2 h-5 w-3/4" />
      <Skeleton className="mt-2.5 h-4 w-full" />
    </div>
  );
}

function BriefingDetail({
  briefing,
  accessToken,
  isAdmin,
  ko,
  onSaved,
  onDeleted,
  onBack,
}: {
  briefing: MarketBriefing;
  accessToken: string | null;
  isAdmin: boolean;
  ko: boolean;
  onSaved: (briefing: MarketBriefing) => void;
  onDeleted: (id: string) => void;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [formError, setFormError] = useState('');

  const handleDelete = async () => {
    if (!accessToken || deletePending) {
      return;
    }
    if (
      !window.confirm(
        ko ? '이 마켓 브리핑을 삭제할까요?' : 'Delete this market briefing?',
      )
    ) {
      return;
    }

    setDeletePending(true);
    setFormError('');
    try {
      await apiRequest<{ ok: true }>(
        `/markets/briefings/${briefing.id}`,
        'DELETE',
        {
          accessToken,
        },
      );
      onDeleted(briefing.id);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : ko
            ? '삭제하지 못했습니다.'
            : 'Could not delete.',
      );
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <article className="rounded-md border border-border bg-surface-muted p-3 sm:p-5">
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<ChevronLeft />}
        onClick={onBack}
        className="mb-4"
      >
        {ko ? '목록으로' : 'Back to list'}
      </Button>

      {isAdmin ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Pencil />}
            onClick={() => {
              setEditing((value) => !value);
              setFormError('');
            }}
          >
            {editing
              ? ko
                ? '수정 취소'
                : 'Cancel edit'
              : ko
                ? '수정'
                : 'Edit'}
          </Button>
          <Button
            variant="soft-danger"
            size="sm"
            leftIcon={<Trash2 />}
            loading={deletePending}
            onClick={handleDelete}
          >
            {deletePending
              ? ko
                ? '삭제 중'
                : 'Deleting'
              : ko
                ? '삭제'
                : 'Delete'}
          </Button>
        </div>
      ) : null}

      {formError ? <Notice message="" error={formError} /> : null}

      {editing ? (
        <BriefingEditForm
          briefing={briefing}
          accessToken={accessToken}
          ko={ko}
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

      <div className="border-b border-border pb-5">
        <p className="text-sm font-semibold text-muted">
          {marketLabel(briefing.market, ko)} ·{' '}
          {marketCaption(briefing.market, ko)}
        </p>
        <h3 className="mt-2 text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
          {briefing.title}
        </h3>
        <p className="mt-2 text-sm font-medium text-muted">
          {new Date(briefing.generatedAt * 1000).toLocaleString(
            ko ? 'ko-KR' : 'en-US',
          )}
        </p>
      </div>

      <section className="mt-5 space-y-4 rounded-md border border-border bg-surface p-4 sm:mt-6 sm:p-5">
        <h4 className="text-base font-semibold text-foreground sm:text-lg">
          {ko ? '시장 전체 요약' : 'Market overview'}
        </h4>
        <div className="space-y-4 text-[15px] leading-7 text-foreground sm:space-y-5 sm:text-base sm:leading-8">
          {(briefing.summaryLines ?? []).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      {(briefing.macroLines ?? []).length ? (
        <section className="mt-5 space-y-4 rounded-md border border-border bg-surface p-4 sm:p-5">
          <h4 className="text-base font-semibold text-foreground sm:text-lg">
            {ko ? '매크로 점검' : 'Macro check'}
          </h4>
          <div className="space-y-4 text-[15px] leading-7 text-foreground sm:space-y-5 sm:text-base sm:leading-8">
            {(briefing.macroLines ?? []).map((line, index) => (
              <p key={`${index}-${line}`}>{line}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-5 space-y-4 rounded-md border border-border bg-surface p-4 sm:p-5">
        <h4 className="text-base font-semibold text-foreground sm:text-lg">
          {ko ? '주요 종목/기업 뉴스' : 'Key stock & company news'}
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
            const headline = cleanCompanyHeadline(
              item.headline,
              companyName,
              ticker,
            );
            return (
              <div
                key={`${ticker || item.symbol || 'symbol'}-${item.headline ?? 'headline'}-${index}`}
                className="border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <h5 className="text-[15px] font-semibold text-foreground sm:text-base">
                  {companyName ||
                    item.symbol ||
                    (ko ? '종목/기업' : 'Stock/Company')}{' '}
                  {ticker ? (
                    <a
                      href={stockHref(ticker, briefing.market)}
                      className="cursor-pointer text-primary underline-offset-2 hover:underline"
                    >
                      #{ticker}
                    </a>
                  ) : null}
                  {change ? (
                    <span
                      className={`ml-1 font-semibold ${
                        change.startsWith('-')
                          ? 'text-negative'
                          : 'text-positive'
                      }`}
                    >
                      ({change})
                    </span>
                  ) : null}
                </h5>
                {headline && lines[0] !== item.headline ? (
                  <p className="mt-1 text-[15px] font-medium text-foreground sm:text-base">
                    {headline}
                  </p>
                ) : null}
                <div className="mt-3 space-y-3 text-[15px] leading-7 text-muted sm:space-y-4 sm:text-base sm:leading-8">
                  {lines.map((line, lineIndex) => (
                    <p key={`${lineIndex}-${line}`}>{line}</p>
                  ))}
                </div>
              </div>
            );
          })}
          {!(briefing.companyNews ?? []).length ? (
            <p className="text-base leading-8 text-muted">
              {ko
                ? '표시할 주요 종목/기업 뉴스가 없습니다.'
                : 'No key stock/company news to show.'}
            </p>
          ) : null}
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-surface p-4 sm:p-5">
          <h4 className="text-base font-semibold text-foreground sm:text-lg">
            {ko ? '오늘의 핵심 키워드' : 'Key keywords'}
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {(briefing.keywords ?? []).map((keyword) => (
              <span
                key={keyword}
                className="rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary"
              >
                {keyword}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-border bg-surface p-4 sm:p-5">
          <h4 className="text-base font-semibold text-foreground sm:text-lg">
            {ko ? '단기 관전 포인트' : 'Short-term watch points'}
          </h4>
          <div className="mt-3 space-y-3 text-[15px] leading-7 text-foreground sm:space-y-4 sm:text-base sm:leading-8">
            {(briefing.watchPoints ?? []).map((point) => (
              <p key={point}>{point}</p>
            ))}
          </div>
        </section>
      </div>

      {briefing.sources?.length ? (
        <section className="mt-5 rounded-md border border-border bg-surface p-4 sm:p-5">
          <h4 className="text-base font-semibold text-foreground sm:text-lg">
            {ko ? '참고 뉴스' : 'Reference news'}
          </h4>
          <div className="mt-3 grid gap-2">
            {briefing.sources.map((item) => (
              <a
                key={`${item.source}-${item.url}`}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block cursor-pointer rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-muted sm:text-base"
              >
                <span className="font-semibold text-foreground">
                  {item.headline}
                </span>
                <span className="ml-2 text-sm text-muted">
                  {item.source} ·{' '}
                  {new Date(item.datetime * 1000).toLocaleDateString(
                    ko ? 'ko-KR' : 'en-US',
                  )}
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
  ko,
  saving,
  setSaving,
  onCancel,
  onSaved,
  onError,
}: {
  briefing: MarketBriefing;
  accessToken: string | null;
  ko: boolean;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onCancel: () => void;
  onSaved: (briefing: MarketBriefing) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(briefing.title);
  const [summaryLines, setSummaryLines] = useState(
    linesToText(briefing.summaryLines),
  );
  const [macroLines, setMacroLines] = useState(
    linesToText(briefing.macroLines ?? []),
  );
  const [companyNews, setCompanyNews] = useState(
    JSON.stringify(briefing.companyNews ?? [], null, 2),
  );
  const [keywords, setKeywords] = useState(
    (briefing.keywords ?? []).join(', '),
  );
  const [watchPoints, setWatchPoints] = useState(
    linesToText(briefing.watchPoints),
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || saving) {
      return;
    }

    let parsedCompanyNews: MarketBriefing['companyNews'];
    try {
      parsedCompanyNews = JSON.parse(
        companyNews,
      ) as MarketBriefing['companyNews'];
      if (!Array.isArray(parsedCompanyNews)) {
        throw new Error('companyNews must be an array.');
      }
    } catch {
      onError(
        ko
          ? '종목/기업 뉴스 JSON 형식이 올바르지 않습니다.'
          : 'Invalid JSON format for stock/company news.',
      );
      return;
    }

    setSaving(true);
    onError('');
    try {
      const updated = await apiRequest<MarketBriefing>(
        `/markets/briefings/${briefing.id}`,
        'PATCH',
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
      onError(
        error instanceof Error
          ? error.message
          : ko
            ? '저장하지 못했습니다.'
            : 'Could not save.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid gap-4 rounded-md border border-border bg-surface p-4"
    >
      <label className="grid gap-1 text-sm font-semibold text-foreground">
        {ko ? '제목' : 'Title'}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-11 rounded-md border border-border-strong bg-surface px-3 text-base font-medium text-foreground outline-none transition-colors focus:border-primary"
        />
      </label>
      <EditTextarea
        label={ko ? '시장 전체 요약' : 'Market overview'}
        value={summaryLines}
        onChange={setSummaryLines}
      />
      <EditTextarea
        label={ko ? '매크로 점검' : 'Macro check'}
        value={macroLines}
        onChange={setMacroLines}
      />
      <EditTextarea
        label={
          ko ? '주요 종목/기업 뉴스 JSON' : 'Key stock/company news (JSON)'
        }
        value={companyNews}
        onChange={setCompanyNews}
        minHeight="260px"
      />
      <EditTextarea
        label={ko ? '핵심 키워드' : 'Keywords'}
        value={keywords}
        onChange={setKeywords}
      />
      <EditTextarea
        label={ko ? '단기 관전 포인트' : 'Watch points'}
        value={watchPoints}
        onChange={setWatchPoints}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          {ko ? '취소' : 'Cancel'}
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          {saving ? (ko ? '저장 중' : 'Saving') : ko ? '저장' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

function EditTextarea({
  label,
  value,
  onChange,
  minHeight = '150px',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-foreground">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ minHeight }}
        className="resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-base font-medium leading-7 text-foreground outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}

function linesToText(value: string[] | undefined): string {
  return (value ?? []).join('\n');
}

function textToLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function isNewBriefing(briefing: MarketBriefing): boolean {
  return Date.now() - briefing.generatedAt * 1000 <= oneDayMs;
}

function briefingCompanyTicker(
  item: MarketBriefing['companyNews'][number],
): string {
  const explicitSymbol = extractTickerTag(item.symbol);
  if (explicitSymbol) {
    return explicitSymbol;
  }

  return extractTickerTag(
    [item.name, item.headline, ...(item.lines ?? [])].filter(Boolean).join(' '),
  );
}

function briefingCompanyName(
  item: MarketBriefing['companyNews'][number],
  ticker: string,
): string {
  const source = item.name || item.headline || item.symbol || '';
  const escapedTicker = escapeRegExp(ticker);
  if (!item.name && escapedTicker) {
    const prefix = source.match(
      new RegExp(`^(.+?)\\s*#${escapedTicker}\\b`, 'i'),
    )?.[1];
    if (prefix?.trim()) {
      return prefix.trim();
    }
  }

  return stripTickerTags(source, ticker)
    .replace(changePattern, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,\s]+$/g, '')
    .trim();
}

function briefingCompanyChange(
  item: MarketBriefing['companyNews'][number],
): string {
  const source = [item.name, item.headline, ...(item.lines ?? [])]
    .filter(Boolean)
    .join(' ');
  return source.match(changePattern)?.[1] ?? '';
}

function cleanCompanyHeadline(
  headline: string | undefined,
  companyName: string,
  ticker: string,
): string {
  let nextHeadline = (headline ?? '').trim();
  if (!nextHeadline) {
    return '';
  }

  const escapedName = escapeRegExp(companyName);
  const escapedTicker = escapeRegExp(ticker);
  if (escapedName && escapedTicker) {
    nextHeadline = nextHeadline.replace(
      new RegExp(
        `^${escapedName}\\s*(?:#${escapedTicker})?(?:\\s+#${escapedTicker})*\\s*(?:\\([+-]\\s*\\d+(?:\\.\\d+)?%[^)]*\\))?\\s*[,，:-]?\\s*`,
        'i',
      ),
      '',
    );
  }

  if (escapedTicker) {
    nextHeadline = nextHeadline.replace(
      new RegExp(
        `^#${escapedTicker}\\s*(?:\\([+-]\\s*\\d+(?:\\.\\d+)?%[^)]*\\))?\\s*[,，:-]?\\s*`,
        'i',
      ),
      '',
    );
  }

  return nextHeadline.replace(changePattern, '').trim();
}

function stripTickerTags(value: string, ticker: string): string {
  const escapedTicker = escapeRegExp(ticker);
  if (!escapedTicker) {
    return value.replace(/#[A-Z0-9.]{1,12}|#\d{6}/gi, '').trim();
  }

  return value
    .replace(new RegExp(`#${escapedTicker}\\b`, 'gi'), '')
    .replace(/#[A-Z0-9.]{1,12}|#\d{6}/gi, '')
    .trim();
}

function extractTickerTag(value: string | undefined): string {
  const text = (value ?? '').trim();
  if (!text) {
    return '';
  }

  const tagged = text.match(/#([A-Z0-9.]{1,12}|\d{6})/i)?.[1];
  if (tagged) {
    return tagged.toUpperCase();
  }

  const clean = text.replace(/^#/, '').trim().toUpperCase();
  return /^[A-Z0-9.]{1,12}$/.test(clean) || /^\d{6}$/.test(clean) ? clean : '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stockHref(symbol: string, fallbackMarket: BriefingMarket): string {
  const cleanSymbol = extractTickerTag(symbol);
  const market = /^\d{6}$/.test(cleanSymbol) ? 'KR' : fallbackMarket;
  const currency = market === 'KR' ? 'KRW' : 'USD';
  return `/?symbol=${encodeURIComponent(cleanSymbol)}&market=${market}&currency=${currency}`;
}
