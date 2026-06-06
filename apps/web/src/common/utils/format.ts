import { DisplayCurrency } from "@/common/types";

/** 표시 통화 환산 (USD↔KRW 고정 환율 1500). sourceCurrency는 자유 문자열 허용. */
export function convertMoneyValue(
  value: number,
  displayCurrency: DisplayCurrency,
  sourceCurrency: string = "USD",
): number {
  if (displayCurrency === sourceCurrency) {
    return value;
  }
  if (displayCurrency === "KRW" && sourceCurrency === "USD") {
    return value * 1500;
  }
  if (displayCurrency === "USD" && sourceCurrency === "KRW") {
    return value / 1500;
  }
  return value;
}

/** 통화 기호 + 환산값. KRW는 정수, USD는 소수 2자리. */
export function formatMoney(
  value: number,
  displayCurrency: DisplayCurrency,
  sourceCurrency: string = "USD",
): string {
  const converted = convertMoneyValue(value, displayCurrency, sourceCurrency);
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
