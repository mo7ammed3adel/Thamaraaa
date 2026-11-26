import PusherServer from 'pusher';

/**
 * Realtime runs against any Pusher-protocol server: Pusher Cloud (set only the
 * keys + cluster) or a self-hosted Soketi (also set PUSHER_HOST/PORT for the
 * server-to-server API and PUSHER_PUBLIC_* for where browsers connect).
 *
 * Everything is read at runtime, never baked into the client bundle, so the
 * same image works with or without realtime and keys can change without a
 * rebuild. The legacy NEXT_PUBLIC_* names are still honoured.
 */
const appId = process.env.PUSHER_APP_ID || '';
const key = process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY || '';
const secret = process.env.PUSHER_SECRET || '';
const cluster = process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu';
const host = process.env.PUSHER_HOST || '';

export const pusherConfigured = Boolean(appId && key && secret);

export const pusherServer = new PusherServer(
  host
    ? {
        appId,
        key,
        secret,
        host,
        port: process.env.PUSHER_PORT || '6001',
        useTLS: process.env.PUSHER_USE_TLS === 'true',
        timeout: 2000,
      }
    : { appId, key, secret, cluster, useTLS: true, timeout: 3000 },
);

/** What a browser needs to open the socket; safe to expose (no secret). */
export type RealtimeClientConfig = {
  key: string;
  cluster: string;
  wsHost?: string;
  wsPort?: number;
  wssPort?: number;
  wsPath?: string;
  forceTLS: boolean;
};

export function realtimeClientConfig(): RealtimeClientConfig | null {
  if (!pusherConfigured) return null;
  const publicHost = process.env.PUSHER_PUBLIC_HOST;
  if (!publicHost) {
    // Self-hosted server but no public address: browsers would be sent to
    // Pusher Cloud with a key it doesn't know. Poll instead of half-working.
    if (host) {
      console.error("PUSHER_HOST is set without PUSHER_PUBLIC_HOST; realtime disabled in browsers.");
      return null;
    }
    return { key, cluster, forceTLS: true };
  }
  const tls = process.env.PUSHER_PUBLIC_TLS !== 'false';
  const port = Number(process.env.PUSHER_PUBLIC_PORT) || (tls ? 443 : 80);
  return {
    key,
    cluster,
    wsHost: publicHost,
    wsPort: port,
    wssPort: port,
    wsPath: process.env.PUSHER_PUBLIC_PATH || undefined,
    forceTLS: tls,
  };
}

/** Shared channel + event every dashboard client listens on for live data. */
export const LIVE_DATA_CHANNEL = "crm-updates";
export const LIVE_DATA_EVENT = "changed";

/**
 * Fire-and-forget realtime "something changed" ping. Dashboard clients react by
 * running a soft refresh, so the exact payload doesn't matter — a timestamp is
 * enough to coalesce bursts. No-ops when Pusher isn't configured (the polling
 * AutoRefresher fallback then keeps pages fresh).
 */
export async function broadcastDataChange(scope?: string): Promise<void> {
  await safeTrigger(LIVE_DATA_CHANNEL, LIVE_DATA_EVENT, { t: Date.now(), scope: scope ?? null });
}

/**
 * Fire-and-forget realtime trigger that never throws and no-ops when Pusher is
 * not configured. Replaces the duplicated `try { ... pusherServer.trigger ... }
 * catch {}` blocks scattered across API routes.
 */
export async function safeTrigger(channel: string | string[], event: string, data: unknown): Promise<void> {
  if (!pusherConfigured) return;
  try {
    await pusherServer.trigger(channel, event, data as Record<string, unknown>);
  } catch (error) {
    console.error(`Pusher trigger failed (${channel}/${event}):`, error);
  }
}
