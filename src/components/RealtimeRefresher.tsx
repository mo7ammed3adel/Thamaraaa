"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * True real-time data updates via Pusher. Subscribes to the shared "crm-updates"
 * channel and runs a soft `router.refresh()` (re-runs server components, keeps
 * client state) whenever the server broadcasts a change — so other users' edits
 * appear within a moment, not on a timer.
 *
 * No-ops when Pusher isn't configured (no NEXT_PUBLIC_PUSHER_KEY); the polling
 * AutoRefresher fallback then keeps pages fresh instead.
 */
export default function RealtimeRefresher() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    if (!key) return;

    let client: any;
    let channel: any;
    let cancelled = false;

    (async () => {
      const PusherModule = await import("pusher-js");
      if (cancelled) return;
      const Pusher = PusherModule.default;
      client = new Pusher(key, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu",
      });
      channel = client.subscribe("crm-updates");
      channel.bind("changed", () => {
        // Coalesce bursts (e.g. a mutation that broadcasts once but arrives while
        // another is pending) into a single refresh.
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (typeof document !== "undefined" && document.hidden) return;
          router.refresh();
        }, 400);
      });
    })();

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      try {
        if (channel) {
          channel.unbind_all();
          client?.unsubscribe("crm-updates");
        }
        client?.disconnect();
      } catch {
        // ignore teardown races
      }
    };
  }, [router]);

  return null;
}
