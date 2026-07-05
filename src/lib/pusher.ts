import PusherServer from 'pusher';
import PusherClient from 'pusher-js';

// Get environment variables or use fallback disabled mode if keys are missing
const appId = process.env.PUSHER_APP_ID || '';
const key = process.env.NEXT_PUBLIC_PUSHER_KEY || '';
const secret = process.env.PUSHER_SECRET || '';
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu';

export const pusherServer = new PusherServer({
  appId,
  key,
  secret,
  cluster,
  useTLS: true,
});

export const getPusherClient = () => {
  if (!key) return null; // Avoid crashing if no pusher key is provided
  return new PusherClient(key, {
    cluster,
  });
};

export const pusherConfigured = Boolean(appId && key && secret);

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
export async function safeTrigger(channel: string, event: string, data: unknown): Promise<void> {
  if (!pusherConfigured) return;
  try {
    await pusherServer.trigger(channel, event, data as Record<string, unknown>);
  } catch (error) {
    console.error(`Pusher trigger failed (${channel}/${event}):`, error);
  }
}
