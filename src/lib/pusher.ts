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
