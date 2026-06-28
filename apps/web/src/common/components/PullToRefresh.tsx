"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, RefreshCw } from "lucide-react";

const TRIGGER_DISTANCE = 72;
const MAX_DISTANCE = 112;

export function PullToRefresh({ ko }: { ko: boolean }) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const distanceRef = useRef(0);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const isMobile = () => window.matchMedia("(max-width: 639px)").matches;
    const shouldIgnore = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          "input, textarea, select, [contenteditable='true'], [data-pull-refresh-ignore], details[open]",
        ),
      );

    const reset = () => {
      startRef.current = null;
      pullingRef.current = false;
      distanceRef.current = 0;
      setDistance(0);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (
        refreshingRef.current ||
        !isMobile() ||
        window.scrollY > 0 ||
        event.touches.length !== 1 ||
        shouldIgnore(event.target)
      ) {
        return;
      }
      const touch = event.touches[0];
      startRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const start = startRef.current;
      if (!start || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (!pullingRef.current && Math.abs(deltaX) > Math.abs(deltaY)) {
        reset();
        return;
      }
      if (deltaY <= 0 || window.scrollY > 0) {
        reset();
        return;
      }

      pullingRef.current = true;
      event.preventDefault();
      const nextDistance = Math.min(MAX_DISTANCE, deltaY * 0.48);
      distanceRef.current = nextDistance;
      setDistance(nextDistance);
    };

    const handleTouchEnd = () => {
      if (!pullingRef.current) {
        reset();
        return;
      }
      if (distanceRef.current >= TRIGGER_DISTANCE) {
        refreshingRef.current = true;
        setRefreshing(true);
        setDistance(TRIGGER_DISTANCE);
        window.setTimeout(() => window.location.reload(), 180);
        return;
      }
      reset();
    };

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", reset);
    };
  }, []);

  if (distance <= 0 && !refreshing) return null;

  const ready = distance >= TRIGGER_DISTANCE;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center sm:hidden"
      style={{
        transform: `translateY(calc(env(safe-area-inset-top) + ${Math.max(8, distance - 48)}px))`,
        transition: refreshing ? "transform 160ms ease" : "none",
      }}
      aria-live="polite"
    >
      <div className="flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-foreground shadow-lg">
        {refreshing ? (
          <RefreshCw className="size-4 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className={`size-4 text-primary transition-transform ${ready ? "rotate-180" : ""}`}
          />
        )}
        <span>
          {refreshing
            ? ko
              ? "\uC0C8\uB85C\uACE0\uCE68 \uC911..."
              : "Refreshing..."
            : ready
              ? ko
                ? "\uB193\uC544\uC11C \uC0C8\uB85C\uACE0\uCE68"
                : "Release to refresh"
              : ko
                ? "\uB2F9\uACA8\uC11C \uC0C8\uB85C\uACE0\uCE68"
                : "Pull to refresh"}
        </span>
      </div>
    </div>
  );
}
