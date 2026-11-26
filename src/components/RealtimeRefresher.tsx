"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { subscribe } from "@/lib/realtime/client";

/**
 * True real-time data updates via Pusher. Subscribes to the shared "crm-updates"
 * channel and runs a soft `router.refresh()` (re-runs server components, keeps
 * client state) whenever the server broadcasts a change — so other users' edits
 * appear within a moment, not on a timer.
 *
 * No-ops when realtime isn't configured; the polling
 * AutoRefresher fallback then keeps pages fresh instead.
 */
export default function RealtimeRefresher() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = subscribe("crm-updates", "changed", () => {
      // Coalesce bursts (a bulk action broadcasts many times) into a single
      // refresh; every refresh re-renders the page on a busy server.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        router.refresh();
      }, 1000);
    });

    return () => {
      off();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [router]);

  return null;
}
