import { DisplayCurrency, Language } from "@/common/types";
import { convertMoneyValue, formatMoney, formatNumber } from "@/common/utils/format";

/** 시가총액 표시. USD 원천은 백만 단위($M), KRW는 조/억 한글 단위. */
export function formatMarketCap(
  value: number,
  displayCurrency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
  exchangeRate?: number | null,
) {
  const converted =
    sourceCurrency === "USD"
      ? convertMoneyValue(value * 1_000_000, displayCurrency, sourceCurrency, exchangeRate)
      : convertMoneyValue(value, displayCurrency, sourceCurrency, exchangeRate);

  if (!Number.isFinite(converted)) {
    return "-";
  }

  if (displayCurrency === "KRW") {
    return formatKoreanLargeAmount(converted);
  }

  if (sourceCurrency === "USD") {
    return `${formatNumber(value)}M`;
  }

  return `$${formatNumber(converted)}`;
}

function formatKoreanLargeAmount(value: number) {
  if (value >= 1_000_000_000_000) {
    return `${formatDecimal(value / 1_000_000_000_000)}조`;
  }

  if (value >= 100_000_000) {
    return `${formatDecimal(value / 100_000_000)}억`;
  }

  return `원${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))}`;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value);
}

export function translateDetailLabel(
  language: Language,
  key:
    | "exchange"
    | "currency"
    | "marketCap"
    | "country"
    | "ipo"
    | "website"
    | "sharesOutstanding"
    | "open"
    | "previousClose"
    | "realtimeChart"
    | "companyOverview"
    | "source"
    | "metrics"
    | "per"
    | "pbr"
    | "eps"
    | "bps"
    | "high52"
    | "low52"
    | "psr"
    | "roe"
    | "dividendYield",
) {
  const labels = {
    en: {
      exchange: "Exchange",
      currency: "Currency",
      marketCap: "Market cap",
      country: "Country",
      ipo: "IPO",
      website: "Website",
      sharesOutstanding: "Shares outstanding",
      open: "Open",
      previousClose: "Previous close",
      realtimeChart: "Realtime price chart",
      companyOverview: "Company overview",
      source: "Source",
      metrics: "Valuation",
      per: "PER",
      pbr: "PBR",
      eps: "EPS",
      bps: "BPS",
      high52: "52W High",
      low52: "52W Low",
      psr: "PSR",
      roe: "ROE",
      dividendYield: "Dividend yield",
    },
    ko: {
      exchange: "거래소",
      currency: "통화",
      marketCap: "시가총액",
      country: "국가",
      ipo: "상장일",
      website: "웹사이트",
      sharesOutstanding: "발행주식수",
      open: "시가",
      previousClose: "전일종가",
      realtimeChart: "실시간 차트",
      companyOverview: "회사 개요",
      source: "출처",
      metrics: "밸류에이션",
      per: "PER",
      pbr: "PBR",
      eps: "EPS",
      bps: "BPS",
      high52: "52주 고가",
      low52: "52주 저가",
      psr: "PSR",
      roe: "ROE",
      dividendYield: "배당수익률",
    },
  } as const;

  return labels[language][key];
}

export function buildMetricItems(
  metrics: Record<string, number | string | null | undefined> | null,
  language: Language,
  currency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
  exchangeRate?: number | null,
  includeBps = false,
) {
  return [
    {
      label: translateDetailLabel(language, "per"),
      value: formatRatio(
        pickMetric(metrics, ["peTTM", "peAnnual", "peRatioTTM", "peRatio"]),
      ),
    },
    {
      label: translateDetailLabel(language, "pbr"),
      value: formatRatio(
        pickMetric(metrics, ["pbAnnual", "pbTTM", "pbRatioAnnual", "pbRatio"]),
      ),
    },
    {
      label: translateDetailLabel(language, "eps"),
      value: formatMoneyValue(
        pickMetric(metrics, ["epsTTM", "epsAnnual", "epsBasicExclExtraTTM"]),
        currency,
        sourceCurrency,
        exchangeRate,
      ),
    },
    ...(includeBps
      ? [
          {
            label: translateDetailLabel(language, "bps"),
            value: formatMoneyValue(
              pickMetric(metrics, ["bpsAnnual", "bpsTTM", "bookValuePerShare"]),
              currency,
              sourceCurrency,
              exchangeRate,
            ),
          },
        ]
      : []),
    {
      label: translateDetailLabel(language, "psr"),
      value: formatRatio(
        pickMetric(metrics, ["psTTM", "psAnnual", "psRatioTTM", "psRatio"]),
      ),
    },
    {
      label: translateDetailLabel(language, "roe"),
      value: formatPercentValue(
        pickMetric(metrics, ["roeTTM", "roeAnnual", "returnOnEquityTTM"]),
      ),
    },
    {
      label: translateDetailLabel(language, "dividendYield"),
      value: formatPercentValue(
        pickMetric(metrics, ["currentDividendYieldTTM", "dividendYieldTTM"]),
      ),
    },
  ];
}

function pickMetric(
  metrics: Record<string, number | string | null | undefined> | null,
  keys: string[],
): number | null {
  if (!metrics) {
    return null;
  }

  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function formatRatio(value: number | null): string {
  return value === null ? "-" : `${value.toFixed(2)}x`;
}

function formatPercentValue(value: number | null): string {
  return value === null ? "-" : `${value.toFixed(2)}%`;
}

function formatMoneyValue(
  value: number | null,
  currency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
  exchangeRate?: number | null,
): string {
  return value === null
    ? "-"
    : formatMoney(value, currency, sourceCurrency, exchangeRate);
}
