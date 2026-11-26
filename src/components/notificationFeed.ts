"use client";

import { useEffect, useState } from "react";
import { listUnreadNotifications, markNotificationRead, type NotificationItem } from "@/client/api/notifications";
import { notify as toast } from "@/components/toast";
import { realtimeConnected, realtimeEnabled, subscribe } from "@/lib/realtime/client";

/**
 * One shared unread-notification feed for the whole dashboard.
 *
 * The layout renders the bell twice (header dropdown + sidebar badge); before
 * this each copy polled on its own and kept its own state, so marking one read
 * left the other badge stale. Now there is a single poller, a single list, and
 * a toast for every notification that arrives while the page is open.
 *
 * Delivery: Pusher (`user-${id}` / "new-notification") triggers an immediate
 * refetch when configured; polling is the guarantee — every 15s without
 * Pusher, every 60s as a safety net with it. Hidden tabs skip polls and catch
 * up the moment they become visible again.
 */
const POLL_MS = 15_000;
// While the socket is connected, the timer is only a safety net.
const LIVE_POLL_MS = 60_000;
let lastLoad = 0;
const MAX_INDIVIDUAL_TOASTS = 3;

type Listener = (items: NotificationItem[]) => void;

let items: NotificationItem[] = [];
let seenIds: Set<string> | null = null; // null until the first successful load
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
let inflight: Promise<void> | null = null;
let pusherTeardown: (() => void) | null = null;
let pusherUserId: string | null = null;

function emit() {
  listeners.forEach((listener) => listener(items));
}

function announce(fresh: NotificationItem[]) {
  if (fresh.length === 0) return;
  if (fresh.length > MAX_INDIVIDUAL_TOASTS) {
    toast(`You have ${fresh.length} new notifications`, "info");
    return;
  }
  // Oldest first so the newest ends up on top of the toast stack.
  [...fresh].reverse().forEach((n) => toast(`${n.title}: ${n.message}`, "info"));
}

export function refreshNotifications(): Promise<void> {
  if (typeof document !== "undefined" && document.hidden) return Promise.resolve();
  if (inflight) return inflight;
  lastLoad = Date.now();

  inflight = (async () => {
    try {
      const { data } = await listUnreadNotifications();
      // A poll that started before a mark-read committed would bring the item
      // back for one tick; hide ids we have just marked read.
      const next = (data || []).filter((n) => !pendingRead.has(n.id));
      if (seenIds === null) {
        // First load: whatever is already unread is not "new" — no toast storm.
        seenIds = new Set(next.map((n) => n.id));
      } else {
        const fresh = next.filter((n) => !seenIds!.has(n.id));
        fresh.forEach((n) => seenIds!.add(n.id));
        announce(fresh);
      }
      items = next;
      emit();
    } catch {
      // Network blip / session expiry — keep the last known list, retry next tick.
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

function onVisibility() {
  if (!document.hidden) void refreshNotifications();
}

function start() {
  void refreshNotifications();
  timer = setInterval(() => {
    if (realtimeConnected() && Date.now() - lastLoad < LIVE_POLL_MS) return;
    void refreshNotifications();
  }, POLL_MS);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onVisibility);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("focus", onVisibility);
  pusherTeardown?.();
  pusherTeardown = null;
  pusherUserId = null;
}

function connectPusher(userId: string) {
  if (!realtimeEnabled() || pusherUserId === userId) return;
  pusherTeardown?.();
  pusherUserId = userId;
  // The payload is not trusted for rendering — just refetch the real list.
  // After a reconnect, refetch too: anything sent while offline was missed.
  pusherTeardown = subscribe(`user-${userId}`, "new-notification", () => void refreshNotifications(), {
    onLive: (live) => {
      if (live) void refreshNotifications();
    },
  });
}

export function subscribeNotifications(listener: Listener, userId?: string | null): () => void {
  listeners.add(listener);
  if (listeners.size === 1) start();
  else listener(items);
  if (userId) connectPusher(userId);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

const pendingRead = new Set<string>();

/**
 * Optimistically drops the notification from every bell, then persists.
 * Resolves false when saving failed (the item comes back on the next poll).
 */
export async function markNotificationAsRead(id: string): Promise<boolean> {
  items = items.filter((n) => n.id !== id);
  pendingRead.add(id);
  emit();
  try {
    await markNotificationRead(id);
    // Keep hiding it briefly, past any poll that was already in flight.
    setTimeout(() => pendingRead.delete(id), 30_000);
    return true;
  } catch {
    pendingRead.delete(id);
    // Put it back on the next poll rather than lying about its state.
    void refreshNotifications();
    return false;
  }
}

export function useUnreadNotifications(userId?: string | null): NotificationItem[] {
  const [list, setList] = useState<NotificationItem[]>(items);
  useEffect(() => subscribeNotifications(setList, userId), [userId]);
  return list;
}
