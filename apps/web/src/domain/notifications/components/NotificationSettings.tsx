"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { apiRequest } from "@/common/lib/api";
import { Button } from "@/common/components/Button";
import { Switch } from "@/common/components/Switch";
import { NotificationPreferences } from "../types";
import { disablePush, enablePush, pushSupported } from "../push";

const rows: Array<{
  key: keyof NotificationPreferences;
  ko: string;
  en: string;
}> = [
  {
    key: "earningsEnabled",
    ko: "관심 종목 실적 일정",
    en: "Earnings schedules",
  },
  { key: "ipoEnabled", ko: "공모주 일정", en: "IPO schedules" },
  { key: "marketBriefingEnabled", ko: "마켓 브리핑", en: "Market briefings" },
  {
    key: "priceEnabled",
    ko: "관심 종목 가격 구간",
    en: "Watchlist price bands",
  },
  {
    key: "communityEnabled",
    ko: "댓글·답글·좋아요",
    en: "Comments, replies and likes",
  },
  {
    key: "newPostEnabled",
    ko: "구독 사용자 새 게시글",
    en: "New posts from subscriptions",
  },
];

export function NotificationSettings({
  accessToken,
  ko,
}: {
  accessToken: string;
  ko: boolean;
}) {
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void apiRequest<NotificationPreferences>(
      "/notifications/preferences",
      "GET",
      {
        accessToken,
      },
    ).then(setPreferences);
  }, [accessToken]);

  async function update(key: keyof NotificationPreferences, value: boolean) {
    if (!preferences) return;
    const optimistic = { ...preferences, [key]: value };
    setPreferences(optimistic);
    try {
      setPreferences(
        await apiRequest<NotificationPreferences>(
          "/notifications/preferences",
          "PATCH",
          {
            accessToken,
            body: { [key]: value },
          },
        ),
      );
    } catch {
      setPreferences(preferences);
    }
  }

  if (!preferences) return null;

  return (
    <section className="mt-6 border-t border-border pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <BellRing size={18} />
            {ko ? "알림 설정" : "Notification settings"}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {ko
              ? "권한 요청은 아래 활성화 버튼을 눌렀을 때만 실행됩니다."
              : "Permission is requested only when you press enable."}
          </p>
        </div>
        {pushSupported() ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await enablePush(accessToken);
                  setMessage(
                    ko
                      ? "이 기기 알림이 활성화되었습니다."
                      : "Enabled on this device.",
                  );
                } catch (error) {
                  setMessage(
                    error instanceof Error ? error.message : "Failed.",
                  );
                }
              }}
            >
              {ko ? "이 기기 활성화" : "Enable device"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await disablePush(accessToken);
                setMessage(
                  ko
                    ? "이 기기 알림을 해제했습니다."
                    : "Disabled on this device.",
                );
              }}
            >
              {ko ? "해제" : "Disable"}
            </Button>
          </div>
        ) : null}
      </div>
      <div className="mt-4 divide-y divide-border rounded-md border border-border">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <span className="text-sm font-medium">{ko ? row.ko : row.en}</span>
            <Switch
              checked={preferences[row.key]}
              onChange={(next) => void update(row.key, next)}
              aria-label={ko ? row.ko : row.en}
            />
          </div>
        ))}
      </div>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </section>
  );
}
