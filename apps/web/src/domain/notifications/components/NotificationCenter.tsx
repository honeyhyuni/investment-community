"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/common/lib/api";
import { usePreferencesStore } from "@/common/stores/preferences";
import { AppNotification, NotificationList } from "../types";
import { enablePush, pushSupported } from "../push";
import { NotificationPreferenceControls } from "./NotificationPreferenceControls";

export function NotificationCenter({ accessToken }: { accessToken: string }) {
  const router = useRouter();
  const ko = usePreferencesStore((state) => state.language) === "ko";
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [data, setData] = useState<NotificationList>({
    items: [],
    unreadCount: 0,
  });
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const result = await apiRequest<NotificationList>(
      "/notifications?limit=30",
      "GET",
      {
        accessToken,
      },
    );
    setData(result);
  }, [accessToken]);

  useEffect(() => {
    queueMicrotask(() => void load().catch(() => undefined));
    const interval = window.setInterval(
      () => void load().catch(() => undefined),
      60_000,
    );
    return () => window.clearInterval(interval);
  }, [load]);

  async function openNotification(item: AppNotification) {
    if (!item.readAt) {
      await apiRequest<{ ok: true }>(
        `/notifications/${item.id}/read`,
        "PATCH",
        {
          accessToken,
        },
      ).catch(() => undefined);
    }
    menuRef.current?.removeAttribute("open");
    router.push(item.url);
    void load();
  }

  async function activate() {
    setMessage("");
    try {
      await enablePush(accessToken);
      setMessage(
        ko ? "이 기기의 알림을 활성화했습니다." : "Notifications enabled.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not enable notifications.",
      );
    }
  }

  return (
    <details ref={menuRef} className="group relative">
      <summary
        className="relative grid size-11 cursor-pointer list-none place-items-center rounded-md border border-border bg-surface text-muted transition-colors hover:border-primary hover:text-primary [&::-webkit-details-marker]:hidden"
        aria-label={ko ? "알림" : "Notifications"}
      >
        <Bell size={19} />
        {data.unreadCount > 0 ? (
          <span className="absolute right-1 top-1 min-w-4 rounded-full bg-negative px-1 text-center text-[10px] font-bold leading-4 text-white">
            {Math.min(data.unreadCount, 99)}
          </span>
        ) : null}
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-semibold">{ko ? "알림" : "Notifications"}</p>
          {data.unreadCount ? (
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary"
              onClick={async () => {
                await apiRequest<{ ok: true }>(
                  "/notifications/read-all",
                  "PATCH",
                  {
                    accessToken,
                  },
                );
                void load();
              }}
            >
              <CheckCheck size={15} />
              {ko ? "모두 읽음" : "Mark all read"}
            </button>
          ) : null}
        </div>
        {pushSupported() && Notification.permission !== "granted" ? (
          <div className="border-b border-border bg-surface-muted p-3">
            <button
              type="button"
              onClick={activate}
              className="h-9 cursor-pointer rounded-md bg-primary px-3 text-sm font-semibold text-white"
            >
              {ko ? "이 기기에서 알림 활성화" : "Enable on this device"}
            </button>
            {message ? (
              <p className="mt-2 text-xs text-muted">{message}</p>
            ) : null}
          </div>
        ) : null}
        <details className="border-b border-border">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
            {ko
              ? "\uC54C\uB9BC \uC885\uB958 \uC124\uC815"
              : "Notification types"}
            <span className="ml-2 text-xs font-normal text-muted">
              {ko ? "\uD074\uB9AD\uD574\uC11C ON/OFF" : "Click to manage"}
            </span>
          </summary>
          <div className="border-t border-border bg-surface-muted/40">
            <NotificationPreferenceControls
              accessToken={accessToken}
              ko={ko}
              compact
            />
          </div>
        </details>
        <div className="max-h-[60vh] overflow-y-auto">
          {data.items.length ? (
            data.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openNotification(item)}
                className={`block w-full cursor-pointer border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-muted ${
                  item.readAt ? "" : "bg-primary/5"
                }`}
              >
                <p className="text-sm font-semibold text-foreground">
                  {item.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-muted">
                  {item.body}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {new Date(item.createdAt).toLocaleString(
                    ko ? "ko-KR" : "en-US",
                  )}
                </p>
              </button>
            ))
          ) : (
            <p className="p-6 text-center text-sm text-muted">
              {ko ? "새 알림이 없습니다." : "No notifications yet."}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
