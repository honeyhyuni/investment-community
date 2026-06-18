"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ExternalLink } from "lucide-react";
import { apiRequest } from "@/common/lib/api";
import { Notice } from "@/common/components/Notice";
import { SectionHeader } from "@/common/components/SectionHeader";
import { Skeleton } from "@/common/components/Skeleton";
import { usePreferencesStore } from "@/common/stores/preferences";
import { useSessionStore } from "@/common/stores/session";
import { IpoCalendarItem } from "@/domain/ipo/types";

type CalendarDay = {
  date: string;
  label: string;
  weekday: string;
  events: IpoCalendarEvent[];
};

type IpoCalendarEvent = {
  item: IpoCalendarItem;
  type: "subscription" | "listing";
};

export function IpoCalendarPage() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const language = usePreferencesStore((s) => s.language);
  const [items, setItems] = useState<IpoCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    apiRequest<IpoCalendarItem[]>("/markets/ipos", "GET", { accessToken })
      .then((nextItems) => {
        if (active) {
          setItems(nextItems);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : language === "ko"
                ? "공모주 일정을 불러오지 못했습니다."
                : "Could not load IPO calendar.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, language]);

  const calendarDays = useMemo(() => buildRollingCalendar(items, language), [
    items,
    language,
  ]);

  return (
    <div className="grid min-w-0 flex-1 gap-4 py-4 sm:gap-6 sm:py-6">
      {error ? <Notice message="" error={error} /> : null}

      <section className="-mx-4 min-w-0 border-y border-border bg-surface p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader
            eyebrow={language === "ko" ? "DART disclosures" : "DART disclosures"}
            title={language === "ko" ? "공모주 캘린더" : "IPO Calendar"}
          />
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <CalendarDays size={14} />
            {items.length}
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          {language === "ko"
            ? "오늘부터 한 달 이내 청약 일정이 있는 DART 공시를 매일 새벽 3시에 갱신합니다."
            : "Updated daily at 3 AM from DART disclosures with subscription dates within the next month."}
        </p>

        {loading ? (
          <IpoCalendarSkeleton />
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {calendarDays.map((day) => (
                <div
                  key={day.date}
                  className="min-h-32 min-w-0 rounded-md border border-border bg-surface-muted p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {day.label}
                      </p>
                      <p className="text-xs font-medium text-muted">{day.weekday}</p>
                    </div>
                    {day.events.length ? (
                      <span className="rounded-full bg-positive/10 px-2 py-0.5 text-xs font-semibold text-positive">
                        {day.events.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-2">
                    {day.events.length ? (
                      day.events.map((event) => (
                        <IpoCompactCard
                          key={`${event.item.id}-${event.type}`}
                          event={event}
                          language={language}
                        />
                      ))
                    ) : (
                      <p className="rounded-md border border-dashed border-border px-2 py-4 text-center text-xs text-muted">
                        {language === "ko" ? "일정 없음" : "No IPOs"}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <h2 className="text-base font-semibold text-foreground">
                {language === "ko" ? "공모주 목록" : "IPO list"}
              </h2>
              <div className="mt-3 grid gap-3">
                {items.length ? (
                  items.map((item) => (
                    <IpoListCard key={item.id} item={item} language={language} />
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-border bg-surface-muted px-4 py-10 text-center text-sm text-muted">
                    {language === "ko"
                      ? "오늘 기준 한 달 이내로 파싱된 공모주 청약 일정이 없습니다."
                      : "No parsed IPO subscription schedules for the next month."}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function IpoCompactCard({
  event,
  language,
}: {
  event: IpoCalendarEvent;
  language: "en" | "ko";
}) {
  const item = event.item;
  const eventLabel =
    event.type === "listing"
      ? language === "ko"
        ? "상장"
        : "Listing"
      : language === "ko"
        ? "공모"
        : "Subscription";
  const eventLabelClass =
    event.type === "listing"
      ? "text-primary"
      : "text-pink-400 dark:text-pink-300";
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface px-2 py-2">
      <p className="break-all text-sm font-semibold leading-5 text-foreground [overflow-wrap:anywhere]">
        {item.corpName}{" "}
        <span className={`text-xs font-semibold ${eventLabelClass}`}>
          ({eventLabel})
        </span>
      </p>
      <p className="mt-1 break-words text-[11px] font-medium leading-4 text-muted">
        {item.underwriter ?? (language === "ko" ? "주관사 미확인" : "Underwriter TBD")}
      </p>
      <p className="mt-1 break-words text-[11px] font-semibold leading-4 text-primary">
        {item.expectedOfferPrice
          ? `${item.expectedOfferPrice}원`
          : language === "ko"
            ? "공모가 미확인"
            : "Price TBD"}
      </p>
    </div>
  );
}

function IpoListCard({
  item,
  language,
}: {
  item: IpoCalendarItem;
  language: "en" | "ko";
}) {
  return (
    <article className="rounded-md border border-border bg-surface-muted p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-foreground">{item.corpName}</p>
          <p className="mt-1 text-xs font-semibold text-muted">
            {item.stockCode ? `${item.stockCode} · ` : ""}
            {item.reportName}
          </p>
        </div>
        <a
          href={item.dartUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          DART
          <ExternalLink size={15} />
        </a>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <InfoCell
          label={language === "ko" ? "청약일" : "Subscription"}
          value={formatSubscription(item, language)}
        />
        <InfoCell
          label={language === "ko" ? "상장일" : "Listing date"}
          value={formatListingDate(item, language)}
        />
        <InfoCell
          label={language === "ko" ? "희망공모가" : "Expected price"}
          value={item.expectedOfferPrice ?? "-"}
        />
        <InfoCell
          label={language === "ko" ? "주관사" : "Underwriter"}
          value={item.underwriter ?? "-"}
        />
        <InfoCell
          label={language === "ko" ? "공시 접수일" : "Filed"}
          value={item.receiptDate}
        />
      </dl>
    </article>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface px-3 py-2">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold leading-5 text-foreground">
        {value}
      </dd>
    </div>
  );
}

function IpoCalendarSkeleton() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 14 }).map((_, index) => (
        <Skeleton key={index} className="h-32 rounded-md" />
      ))}
    </div>
  );
}

function buildRollingCalendar(
  items: IpoCalendarItem[],
  language: "en" | "ko",
): CalendarDay[] {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
  });
  const weekdayFormatter = new Intl.DateTimeFormat(
    language === "ko" ? "ko-KR" : "en-US",
    { weekday: "short" },
  );

  return Array.from({ length: 32 }).reduce<CalendarDay[]>((days, _, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() + index);
    if (isWeekend(date)) {
      return days;
    }
    const key = toDateKey(date);
    days.push({
      date: key,
      label: formatter.format(date),
      weekday: weekdayFormatter.format(date),
      events: buildCalendarEvents(items, key),
    });
    return days;
  }, []);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isDateInSubscriptionRange(item: IpoCalendarItem, date: string): boolean {
  if (!item.subscriptionStartDate) {
    return false;
  }
  const endDate = item.subscriptionEndDate ?? item.subscriptionStartDate;
  return item.subscriptionStartDate <= date && date <= endDate;
}

function buildCalendarEvents(
  items: IpoCalendarItem[],
  date: string,
): IpoCalendarEvent[] {
  return items.flatMap((item) => {
    const events: IpoCalendarEvent[] = [];
    if (isDateInSubscriptionRange(item, date)) {
      events.push({ item, type: "subscription" });
    }
    if (item.listingDate === date) {
      events.push({ item, type: "listing" });
    }
    return events;
  });
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function formatSubscription(item: IpoCalendarItem, language: "en" | "ko"): string {
  if (item.subscriptionDateText) {
    return item.subscriptionDateText;
  }
  if (item.subscriptionStartDate) {
    return item.subscriptionStartDate;
  }
  return language === "ko" ? "원문 확인 필요" : "Check DART filing";
}

function formatListingDate(item: IpoCalendarItem, language: "en" | "ko"): string {
  if (item.listingDateText) {
    return item.listingDateText;
  }
  if (item.listingDate) {
    return item.listingDate;
  }
  return language === "ko" ? "상장일 미정" : "Listing date TBD";
}
