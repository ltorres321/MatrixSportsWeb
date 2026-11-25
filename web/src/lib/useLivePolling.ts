"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// How often to re-run the Server Component while something on screen is
// live. Each refresh is one Netlify function invocation, so this is a
// direct cost knob: 30s (was 20s) still reads as live, and
// liveScores.ts's own 30s fetch cache means a faster poll mostly
// re-rendered identical data anyway.
export const LIVE_REFRESH_MS = 30_000;

// Re-runs the current route's Server Component on an interval while
// `enabled` is true -- and ONLY while the tab is actually visible. A
// hidden tab (backgrounded, minimized, locked phone) stops polling, so a
// tab left open through a whole game no longer costs a function
// invocation every few seconds. On returning to the tab it refreshes
// once immediately (so scores aren't stale for up to a full interval),
// then resumes the normal cadence.
export function useLivePolling(enabled: boolean, intervalMs: number = LIVE_REFRESH_MS) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (timer === undefined) {
        timer = setInterval(() => router.refresh(), intervalMs);
      }
    };
    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, [enabled, intervalMs, router]);
}
