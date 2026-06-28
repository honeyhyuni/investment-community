"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/common/components/Switch";
import { apiRequest } from "@/common/lib/api";
import { NotificationPreferences } from "../types";

const preferenceRows: Array<{
  key: keyof NotificationPreferences;
  ko: string;
  en: string;
}> = [
  {
    key: "priceEnabled",
    ko: "\uAD00\uC2EC \uC885\uBAA9 \uAC00\uACA9 \uAD6C\uAC04",
    en: "Watchlist price bands",
  },
  {
    key: "earningsEnabled",
    ko: "\uAD00\uC2EC \uC885\uBAA9 \uC2E4\uC801 \uC77C\uC815",
    en: "Earnings schedules",
  },
  {
    key: "marketBriefingEnabled",
    ko: "\uB9C8\uCF13 \uBE0C\uB9AC\uD551",
    en: "Market briefings",
  },
  {
    key: "ipoEnabled",
    ko: "\uACF5\uBAA8\uC8FC \uC77C\uC815",
    en: "IPO schedules",
  },
  {
    key: "communityEnabled",
    ko: "\uB313\uAE00\u00B7\uB2F5\uAE00\u00B7\uC88B\uC544\uC694",
    en: "Comments, replies and likes",
  },
  {
    key: "newPostEnabled",
    ko: "\uAD6C\uB3C5 \uC0AC\uC6A9\uC790 \uC0C8 \uAC8C\uC2DC\uAE00",
    en: "New posts from subscriptions",
  },
];

export function NotificationPreferenceControls({
  accessToken,
  ko,
  compact = false,
}: {
  accessToken: string;
  ko: boolean;
  compact?: boolean;
}) {
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [savingKey, setSavingKey] = useState<
    keyof NotificationPreferences | null
  >(null);

  useEffect(() => {
    let active = true;
    void apiRequest<NotificationPreferences>(
      "/notifications/preferences",
      "GET",
      { accessToken },
    ).then((result) => {
      if (active) setPreferences(result);
    });
    return () => {
      active = false;
    };
  }, [accessToken]);

  async function update(key: keyof NotificationPreferences, value: boolean) {
    if (!preferences || savingKey) return;
    const previous = preferences;
    setPreferences({ ...preferences, [key]: value });
    setSavingKey(key);
    try {
      setPreferences(
        await apiRequest<NotificationPreferences>(
          "/notifications/preferences",
          "PATCH",
          { accessToken, body: { [key]: value } },
        ),
      );
    } catch {
      setPreferences(previous);
    } finally {
      setSavingKey(null);
    }
  }

  if (!preferences) {
    return (
      <p className="px-3 py-4 text-center text-xs text-muted">
        {ko
          ? "\uC124\uC815\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4."
          : "Loading settings..."}
      </p>
    );
  }

  return (
    <div
      className={
        compact
          ? "divide-y divide-border"
          : "divide-y divide-border rounded-md border border-border"
      }
    >
      {preferenceRows.map((row) => (
        <div
          key={row.key}
          className={`flex items-center justify-between gap-4 ${
            compact ? "px-3 py-2.5" : "px-4 py-3"
          }`}
        >
          <span className="text-sm font-medium text-foreground">
            {ko ? row.ko : row.en}
          </span>
          <Switch
            checked={preferences[row.key]}
            disabled={savingKey !== null}
            onChange={(next) => void update(row.key, next)}
            aria-label={ko ? row.ko : row.en}
          />
        </div>
      ))}
    </div>
  );
}
