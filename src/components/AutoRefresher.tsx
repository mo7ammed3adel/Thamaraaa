"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { realtimeConnected } from "@/lib/realtime/client";

/**
 * Keeps every dashboard page's server-fetched data fresh without a manual
 * reload. Calls `router.refresh()` — a soft refresh that re-runs the server
 * components and streams new data in while preserving client state (open
 * modals, form inputs, scroll) — on a fixed interval and immediately whenever
 * the tab regains focus. Skips work while the tab is hidden to avoid needless
 * load on the database.
 *
 * The interval is deliberately conservative: the user's own actions already
 * call router.refresh() right after they happen, so this periodic pass only
 * exists to pick up OTHER users' changes. A focus refresh covers "I just came
 * back to the tab", so the timer can stay gentle to keep DB load low.
 */
export default function AutoRefresher({
  intervalMs = 60000,
  liveIntervalMs = 30000,
}: {
  intervalMs?: number;
  /** Used instead while the realtime socket is connected and pushing changes. */
  liveIntervalMs?: number;
}) {
  const router = useRouter();
  const refreshing = useRef(false);
  const last = useRef(Date.now());

  useEffect(() => {
    const refresh = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (refreshing.current) return;
      refreshing.current = true;
      last.current = Date.now();
      router.refresh();
      // router.refresh() has no completion callback; release the guard shortly
      // after so we never queue overlapping refreshes.
      window.setTimeout(() => {
        refreshing.current = false;
      }, 1500);
    };

    const tick = () => {
      if (realtimeConnected() && Date.now() - last.current < liveIntervalMs) return;
      refresh();
    };
    const interval = window.setInterval(tick, Math.min(intervalMs, liveIntervalMs));
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [router, intervalMs, liveIntervalMs]);

  return null;
}
