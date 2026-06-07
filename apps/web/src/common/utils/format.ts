import { DisplayCurrency } from "@/common/types";

/** 표시 통화 환산. exchangeRate는 KIS에서 조회한 USD/KRW 환율이다. */
export function convertMoneyValue(
  value: number,
  displayCurrency: DisplayCurrency,
  sourceCurrency: string = "USD",
  exchangeRate?: number | null,
): number {
  if (displayCurrency === sourceCurrency) {
    return value;
  }
  if (displayCurrency === "KRW" && sourceCurrency === "USD") {
    return exchangeRate && exchangeRate > 0 ? value * exchangeRate : Number.NaN;
  }
  if (displayCurrency === "USD" && sourceCurrency === "KRW") {
    return exchangeRate && exchangeRate > 0 ? value / exchangeRate : Number.NaN;
  }
  return value;
}

/** 통화 기호 + 환산값. KRW는 정수, USD는 소수 2자리. */
export function formatMoney(
  value: number,
  displayCurrency: DisplayCurrency,
  sourceCurrency: string = "USD",
  exchangeRate?: number | null,
): string {
  const converted = convertMoneyValue(value, displayCurrency, sourceCurrency, exchangeRate);
  if (!Number.isFinite(converted)) {
    return "-";
  }
  const symbol = displayCurrency === "KRW" ? "원" : "$";
  const fractionDigits = displayCurrency === "KRW" ? 0 : 2;

  return `${symbol}${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(converted || 0)}`;
}

/** 소수 2자리 천단위 포맷. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value || 0);
}
