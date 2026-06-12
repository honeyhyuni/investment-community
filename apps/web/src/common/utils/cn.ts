import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 조건부 className 조합 + Tailwind 충돌 해소 (뒤에 오는 클래스가 이김). */
export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}

export type { ClassValue };
