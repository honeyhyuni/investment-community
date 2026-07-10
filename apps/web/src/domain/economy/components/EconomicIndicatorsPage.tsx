'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ExternalLink } from 'lucide-react';
import { Notice } from '@/common/components/Notice';
import { SectionHeader } from '@/common/components/SectionHeader';
import { SegmentedControl } from '@/common/components/SegmentedControl';
import { Skeleton } from '@/common/components/Skeleton';
import { apiRequest } from '@/common/lib/api';
import { usePreferencesStore } from '@/common/stores/preferences';
import { useSessionStore } from '@/common/stores/session';
import type { EconomicIndicator } from '@/domain/ipo/types';

type Period = '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y' | 'MAX';

type IndicatorMeta = {
  ko: string;
  en: string;
  unitKo: string;
  unitEn: string;
  descriptionKo: string;
  descriptionEn: string;
  categoryKo: string;
  categoryEn: string;
};

const SERIES_ORDER = [
  'CPIAUCSL',
  'PCEPI',
  'PCEPILFE',
  'PPIACO',
  'UNRATE',
  'PAYEMS',
  'GDPC1',
  'FEDFUNDS',
  'DGS10',
  'T10Y2Y',
  'M1SL',
  'M2SL',
  'BOGMBASE',
  'WALCL',
  'D2WLTGAL',
] as const;

const META: Record<string, IndicatorMeta> = {
  CPIAUCSL: {
    ko: '소비자물가지수 (CPI)',
    en: 'Consumer Price Index (CPI)',
    unitKo: '지수',
    unitEn: 'Index',
    descriptionKo: '미국 도시 소비자가 지불하는 상품·서비스 가격 수준입니다.',
    descriptionEn: 'Price level paid by urban consumers for goods and services in the US.',
    categoryKo: '물가',
    categoryEn: 'Prices',
  },
  PCEPI: {
    ko: 'PCE 물가지수',
    en: 'PCE Price Index',
    unitKo: '지수',
    unitEn: 'Index',
    descriptionKo: '미국 개인소비지출 기준 물가 흐름입니다.',
    descriptionEn: 'Inflation trend based on US personal consumption expenditures.',
    categoryKo: '물가',
    categoryEn: 'Prices',
  },
  PCEPILFE: {
    ko: '근원 PCE 물가지수',
    en: 'Core PCE Price Index',
    unitKo: '지수',
    unitEn: 'Index',
    descriptionKo: '식품·에너지를 제외한 PCE 물가지수입니다.',
    descriptionEn: 'PCE price index excluding food and energy.',
    categoryKo: '물가',
    categoryEn: 'Prices',
  },
  PPIACO: {
    ko: '생산자물가지수 (PPI)',
    en: 'Producer Price Index (PPI)',
    unitKo: '지수',
    unitEn: 'Index',
    descriptionKo: '미국 생산자 단계의 가격 압력을 보여줍니다.',
    descriptionEn: 'Price pressure at the US producer level.',
    categoryKo: '물가',
    categoryEn: 'Prices',
  },
  UNRATE: {
    ko: '실업률',
    en: 'Unemployment Rate',
    unitKo: '%',
    unitEn: '%',
    descriptionKo: '미국 노동시장 고용 상황을 보여주는 대표 지표입니다.',
    descriptionEn: 'A headline gauge of US labor-market conditions.',
    categoryKo: '고용',
    categoryEn: 'Labor',
  },
  PAYEMS: {
    ko: '비농업 고용',
    en: 'Nonfarm Payrolls',
    unitKo: '천 명',
    unitEn: 'Thousand persons',
    descriptionKo: '농업을 제외한 미국 사업체 고용자 수입니다.',
    descriptionEn: 'US establishment employment excluding farm workers.',
    categoryKo: '고용',
    categoryEn: 'Labor',
  },
  GDPC1: {
    ko: '실질 국내총생산 (GDP)',
    en: 'Real Gross Domestic Product (GDP)',
    unitKo: '십억 달러',
    unitEn: 'Billion USD',
    descriptionKo: '물가 영향을 제거한 미국 경제의 총생산 규모입니다.',
    descriptionEn: 'Inflation-adjusted output of the US economy.',
    categoryKo: '성장',
    categoryEn: 'Growth',
  },
  FEDFUNDS: {
    ko: '연방기금금리',
    en: 'Federal Funds Rate',
    unitKo: '%',
    unitEn: '%',
    descriptionKo: '미국 단기 기준금리 흐름을 보여주는 지표입니다.',
    descriptionEn: 'A benchmark series for US short-term interest rates.',
    categoryKo: '금리',
    categoryEn: 'Rates',
  },
  DGS10: {
    ko: '미국 10년 국채금리',
    en: '10-Year Treasury Rate',
    unitKo: '%',
    unitEn: '%',
    descriptionKo: '미국 장기금리와 할인율 부담을 보여주는 대표 금리입니다.',
    descriptionEn: 'A key long-term US interest-rate benchmark.',
    categoryKo: '금리',
    categoryEn: 'Rates',
  },
  T10Y2Y: {
    ko: '10년-2년 금리차',
    en: '10-Year Minus 2-Year Treasury Spread',
    unitKo: '%p',
    unitEn: 'pp',
    descriptionKo: '장단기 금리차로 경기침체 우려와 수익률곡선 상태를 봅니다.',
    descriptionEn: 'Yield-curve spread used to monitor recession risk and curve shape.',
    categoryKo: '금리',
    categoryEn: 'Rates',
  },
  M1SL: {
    ko: 'M1 통화량',
    en: 'M1 Money Stock',
    unitKo: '십억 달러',
    unitEn: 'Billion USD',
    descriptionKo: '현금성 통화와 요구불예금 등 좁은 의미의 통화량입니다.',
    descriptionEn: 'Narrow money stock including highly liquid money balances.',
    categoryKo: '유동성',
    categoryEn: 'Liquidity',
  },
  M2SL: {
    ko: 'M2 통화량',
    en: 'M2 Money Stock',
    unitKo: '십억 달러',
    unitEn: 'Billion USD',
    descriptionKo: 'M1에 저축성 예금 등을 더한 넓은 의미의 통화량입니다.',
    descriptionEn: 'Broad money stock including M1 plus savings-like balances.',
    categoryKo: '유동성',
    categoryEn: 'Liquidity',
  },
  BOGMBASE: {
    ko: '통화기저 (M0 대체)',
    en: 'Monetary Base (M0 Proxy)',
    unitKo: '백만 달러',
    unitEn: 'Million USD',
    descriptionKo: '현금과 지급준비금 기반의 본원통화 흐름입니다.',
    descriptionEn: 'Base money built from currency and reserve balances.',
    categoryKo: '유동성',
    categoryEn: 'Liquidity',
  },
  WALCL: {
    ko: '연준 총자산',
    en: 'Federal Reserve Total Assets',
    unitKo: '백만 달러',
    unitEn: 'Million USD',
    descriptionKo: '연준 대차대조표 규모로 양적완화·긴축 흐름을 봅니다.',
    descriptionEn: 'Federal Reserve balance-sheet size, useful for QE/QT tracking.',
    categoryKo: '유동성',
    categoryEn: 'Liquidity',
  },
  D2WLTGAL: {
    ko: 'TGA 잔고',
    en: 'Treasury General Account',
    unitKo: '백만 달러',
    unitEn: 'Million USD',
    descriptionKo: '미 재무부가 뉴욕 연준에 보유한 일반계정 잔고입니다.',
    descriptionEn: 'US Treasury General Account balance held at the New York Fed.',
    categoryKo: '유동성',
    categoryEn: 'Liquidity',
  },
};

const PERIODS: Period[] = ['1M', '3M', '6M', '1Y', '5Y', '10Y', 'MAX'];

export function EconomicIndicatorsPage() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const ko = usePreferencesStore((state) => state.language) === 'ko';
  const [summary, setSummary] = useState<EconomicIndicator[]>([]);
  const [history, setHistory] = useState<EconomicIndicator[]>([]);
  const [selected, setSelected] = useState<string>('CPIAUCSL');
  const [period, setPeriod] = useState<Period>('5Y');
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    setLoadingSummary(true);
    apiRequest<EconomicIndicator[]>('/markets/calendar/economic/us?latest=true', 'GET', { accessToken })
      .then(setSummary)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load indicators.'))
      .finally(() => setLoadingSummary(false));
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !selected) return;
    setLoadingHistory(true);
    const params = new URLSearchParams({ seriesId: selected, limit: '50000' });
    apiRequest<EconomicIndicator[]>(`/markets/calendar/economic/us?${params.toString()}`, 'GET', { accessToken })
      .then(setHistory)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load indicator history.'))
      .finally(() => setLoadingHistory(false));
  }, [accessToken, selected]);

  const latest = useMemo(() => {
    const map = new Map<string, EconomicIndicator>();
    summary.forEach((item) => {
      if (!map.has(item.seriesId)) map.set(item.seriesId, item);
    });
    return [...map.values()].sort((a, b) => seriesOrder(a.seriesId) - seriesOrder(b.seriesId));
  }, [summary]);

  const visibleHistory = useMemo(() => {
    const rows = history
      .filter((item) => item.seriesId === selected)
      .sort((a, b) => a.observationDate.localeCompare(b.observationDate));

    if (period === 'MAX') return rows;

    const cutoff = new Date();
    if (period.endsWith('M')) {
      cutoff.setMonth(cutoff.getMonth() - Number(period.replace('M', '')));
    } else {
      cutoff.setFullYear(cutoff.getFullYear() - Number(period.replace('Y', '')));
    }
    return rows.filter((item) => new Date(`${item.observationDate}T00:00:00Z`) >= cutoff);
  }, [history, period, selected]);

  if (loadingSummary) {
    return <div className="py-6"><Skeleton className="h-[32rem]" /></div>;
  }

  return (
    <div className="grid gap-4 py-4 sm:gap-6 sm:py-6">
      <SectionHeader eyebrow="FRED" title={ko ? '경제 지표' : 'Economic Indicators'} />
      <p className="-mt-3 text-sm text-muted">
        {ko
          ? '물가, 고용, 성장, 금리, 유동성 지표의 장기 추이를 FRED 공식 데이터로 확인합니다.'
          : 'Track long-run trends in prices, labor, growth, rates, and liquidity using official FRED data.'}
      </p>

      {error ? <Notice message="" error={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {latest.map((item) => {
          const meta = META[item.seriesId];
          const actual = Number(item.actual);
          const previous = Number(item.previous);
          const change = actual - previous;
          return (
            <button
              key={item.seriesId}
              type="button"
              onClick={() => setSelected(item.seriesId)}
              className={`rounded-lg border p-4 text-left shadow-sm transition ${
                selected === item.seriesId
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border bg-surface hover:border-primary/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-primary">{meta ? (ko ? meta.categoryKo : meta.categoryEn) : item.seriesId}</p>
                  <h2 className="mt-1 font-semibold">{ko ? meta?.ko : meta?.en}</h2>
                </div>
                <Activity size={18} className="text-muted" />
              </div>
              <p className="mt-3 text-2xl font-bold">
                {formatValue(actual, item.seriesId)}{' '}
                <span className="text-xs font-semibold text-muted">{ko ? meta?.unitKo : meta?.unitEn}</span>
              </p>
              <p className={`mt-1 text-xs font-semibold ${change >= 0 ? 'text-positive' : 'text-negative'}`}>
                {Number.isFinite(change) ? `${change >= 0 ? '+' : ''}${formatValue(change, item.seriesId)}` : '-'}
              </p>
              <p className="mt-2 text-xs text-muted">
                {ko
                  ? `기준 ${formatDate(item.observationDate, true)} · 직전 관측값 대비`
                  : `As of ${formatDate(item.observationDate, false)} · Change vs previous observation`}
              </p>
            </button>
          );
        })}
      </div>

      {latest.length ? (
        <IndicatorChart
          rows={visibleHistory}
          seriesId={selected}
          period={period}
          onPeriodChange={setPeriod}
          ko={ko}
          loading={loadingHistory}
          sourceUrl={latest.find((item) => item.seriesId === selected)?.sourceUrl ?? `https://fred.stlouisfed.org/series/${selected}`}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted">
          {ko ? '저장된 경제 지표가 없습니다.' : 'No economic indicator data.'}
        </div>
      )}
    </div>
  );
}

function IndicatorChart({
  rows,
  seriesId,
  period,
  onPeriodChange,
  ko,
  loading,
  sourceUrl,
}: {
  rows: EconomicIndicator[];
  seriesId: string;
  period: Period;
  onPeriodChange: (value: Period) => void;
  ko: boolean;
  loading: boolean;
  sourceUrl: string;
}) {
  const meta = META[seriesId];

  if (loading) {
    return <Skeleton className="h-[28rem]" />;
  }

  if (!rows.length) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
        {ko ? '선택한 기간에 표시할 데이터가 없습니다.' : 'No data for the selected period.'}
      </section>
    );
  }

  const width = 840;
  const height = 360;
  const left = 82;
  const right = 28;
  const top = 26;
  const bottom = 60;
  const values = rows.map((row) => Number(row.actual)).filter(Number.isFinite);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.08, Math.abs(rawMax) * 0.01, 0.1);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const range = Math.max(max - min, 1);
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const point = (value: number, index: number) => ({
    x: left + (rows.length <= 1 ? 0 : index / (rows.length - 1)) * chartWidth,
    y: top + (1 - (value - min) / range) * chartHeight,
  });

  const path = rows
    .map((row, index) => {
      const p = point(Number(row.actual), index);
      return `${index ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    })
    .join(' ');
  const yTicks = Array.from({ length: 5 }, (_, index) => max - (index * range) / 4);
  const xIndexes = [...new Set(Array.from({ length: Math.min(6, rows.length) }, (_, index) => Math.round((index * Math.max(rows.length - 1, 0)) / Math.max(Math.min(6, rows.length) - 1, 1))))];
  const lastPoint = point(Number(rows.at(-1)!.actual), rows.length - 1);

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-primary">{ko ? meta?.categoryKo : meta?.categoryEn}</p>
          <h2 className="mt-1 text-lg font-semibold">{ko ? meta?.ko : meta?.en}</h2>
          <p className="mt-1 text-xs text-muted">
            {ko ? meta?.descriptionKo : meta?.descriptionEn}
          </p>
          <p className="mt-1 text-xs text-muted">
            {ko ? `${meta?.unitKo} · 계절조정 여부는 FRED 원자료 기준` : `${meta?.unitEn} · Seasonal adjustment follows FRED`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<Period>
            value={period}
            onChange={onPeriodChange}
            options={PERIODS.map((value) => ({ value, label: value === 'MAX' && ko ? '전체' : value }))}
          />
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="FRED source"
            className="grid size-10 place-items-center rounded-md border border-border text-primary"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[360px] min-w-[700px] w-full" role="img" aria-label={ko ? `${meta?.ko} 추이 차트` : `${meta?.en} trend chart`}>
          {yTicks.map((tick) => {
            const y = top + ((max - tick) / range) * chartHeight;
            return (
              <g key={tick}>
                <line x1={left} x2={width - right} y1={y} y2={y} stroke="currentColor" className="text-border" strokeDasharray="3 4" />
                <text x={left - 10} y={y + 4} textAnchor="end" className="fill-muted text-[11px]">{formatAxis(tick)}</text>
              </g>
            );
          })}
          <line x1={left} x2={left} y1={top} y2={height - bottom} stroke="currentColor" className="text-border-strong" />
          <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="currentColor" className="text-border-strong" />
          {xIndexes.map((index) => {
            const p = point(Number(rows[index]?.actual ?? 0), index);
            return (
              <g key={index}>
                <line x1={p.x} x2={p.x} y1={height - bottom} y2={height - bottom + 5} stroke="currentColor" className="text-border-strong" />
                <text x={p.x} y={height - bottom + 22} textAnchor="middle" className="fill-muted text-[11px]">{rows[index]?.observationDate.slice(0, 7)}</text>
              </g>
            );
          })}
          <text transform={`translate(18 ${(top + height - bottom) / 2}) rotate(-90)`} textAnchor="middle" className="fill-muted text-[11px]">
            {ko ? meta?.unitKo : meta?.unitEn}
          </text>
          <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill="#2563eb" />
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>{`${formatDate(rows[0].observationDate, ko)} ~ ${formatDate(rows.at(-1)!.observationDate, ko)}`}</span>
        <span>{ko ? `관측값 ${rows.length}개` : `${rows.length} observations`}</span>
      </div>
    </section>
  );
}

function seriesOrder(seriesId: string) {
  const index = SERIES_ORDER.indexOf(seriesId as (typeof SERIES_ORDER)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function formatValue(value: number, seriesId: string) {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: ['PAYEMS', 'GDPC1', 'M1SL', 'M2SL', 'BOGMBASE', 'WALCL', 'D2WLTGAL'].includes(seriesId) ? 0 : 2,
  }).format(value);
}

function formatAxis(value: number) {
  return Math.abs(value) >= 1000
    ? new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
    : value.toFixed(Math.abs(value) < 10 ? 2 : 1);
}

function formatDate(value: string, ko: boolean) {
  return new Intl.DateTimeFormat(ko ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T00:00:00Z`));
}
