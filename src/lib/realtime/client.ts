"use client";

import type { RealtimeClientConfig } from "@/lib/pusher";

/**
 * One shared realtime socket per tab.
 *
 * Every live widget (notifications, warnings, chat, page refresher, finance)
 * used to open its own Pusher connection — five sockets per tab against a
 * server that is short on CPU. They now share one connection and refcount the
 * channels they listen on.
 *
 * The config is injected by the root layout at request time
 * (`window.__THAMARAA_RT__`), so nothing about realtime is baked into the
 * bundle. With no config every call here is a no-op and callers keep polling.
 */

declare global {
  interface Window {
    __THAMARAA_RT__?: RealtimeClientConfig | null;
  }
}

type Handler = (data: any) => void;
type PusherLike = import("pusher-js").default;

let clientPromise: Promise<PusherLike | null> | null = null;
let connected = false;
const refs = new Map<string, number>();

export function realtimeConfig(): RealtimeClientConfig | null {
  if (typeof window === "undefined") return null;
  return window.__THAMARAA_RT__ ?? null;
}

export function realtimeEnabled(): boolean {
  return realtimeConfig() !== null;
}

/**
 * True only while the socket is actually up. Pollers use this — not
 * "configured" — to decide whether they may slow down, so a broken or
 * misconfigured socket never leaves the app on the slow safety-net timers.
 */
export function realtimeConnected(): boolean {
  return connected;
}

function getClient(): Promise<PusherLike | null> {
  const cfg = realtimeConfig();
  if (!cfg) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("pusher-js")
      .then(({ default: Pusher }) => {
        const selfHosted = Boolean(cfg.wsHost);
        const client = new Pusher(cfg.key, {
          cluster: cfg.cluster,
          forceTLS: cfg.forceTLS,
          // The only private channel is the chat one; its auth lives here.
          channelAuthorization: { endpoint: "/api/chat/pusher-auth", transport: "ajax" },
          ...(selfHosted
            ? {
                wsHost: cfg.wsHost,
                wsPort: cfg.wsPort,
                wssPort: cfg.wssPort,
                wsPath: cfg.wsPath,
                enabledTransports: ["ws", "wss"],
                disableStats: true,
              }
            : {}),
        });
        client.connection.bind("state_change", ({ current }: { current: string }) => {
          connected = current === "connected";
        });
        return client;
      })
      .catch((error) => {
        console.error("Realtime unavailable, falling back to polling:", error);
        clientPromise = null;
        return null;
      });
  }
  return clientPromise;
}

export type SubscribeOptions = {
  /**
   * Called with true once the channel is subscribed (and again after every
   * reconnect — anything sent while offline was missed, so refetch then), and
   * with false whenever the socket drops.
   */
  onLive?: (live: boolean) => void;
};

/**
 * Listen for `event` on `channel`. Returns an unsubscribe function; the socket
 * itself stays open for the other listeners in the tab.
 */
export function subscribe(channelName: string, event: string, handler: Handler, opts: SubscribeOptions = {}): () => void {
  let cancelled = false;
  let teardown: (() => void) | null = null;

  void getClient().then((client) => {
    if (!client || cancelled) return;
    const channel = client.subscribe(channelName);
    refs.set(channelName, (refs.get(channelName) ?? 0) + 1);
    // A wrapper per subscription: unbind(event, fn) drops every binding of fn,
    // so two subscribers passing the same function must not share it.
    const own: Handler = (data) => handler(data);
    channel.bind(event, own);

    const onSubscribed = () => opts.onLive?.(true);
    const onState = ({ current }: { current: string }) => {
      if (current !== "connected") opts.onLive?.(false);
    };
    if (opts.onLive) {
      channel.bind("pusher:subscription_succeeded", onSubscribed);
      client.connection.bind("state_change", onState);
      if (channel.subscribed && client.connection.state === "connected") opts.onLive(true);
    }

    teardown = () => {
      channel.unbind(event, own);
      if (opts.onLive) {
        channel.unbind("pusher:subscription_succeeded", onSubscribed);
        client.connection.unbind("state_change", onState);
      }
      const left = (refs.get(channelName) ?? 1) - 1;
      if (left <= 0) {
        refs.delete(channelName);
        client.unsubscribe(channelName);
      } else {
        refs.set(channelName, left);
      }
    };
  });

  return () => {
    cancelled = true;
    try {
      teardown?.();
    } catch {
      // ignore teardown races
    }
    teardown = null;
  };
}
