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

const pusherConfigured = Boolean(appId && key && secret);

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
