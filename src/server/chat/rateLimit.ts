/**
 * Small in-memory sliding-window limiter. The app runs as a single Next.js
 * process, so a per-process window is enough to stop a stuck client or a
 * script from flooding a conversation; it resets on restart, which is fine.
 */
const windows = new Map<string, number[]>();

export function allowAction(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    windows.set(key, recent);
    return false;
  }
  recent.push(now);
  windows.set(key, recent);

  // Keep the map from growing without bound across many users.
  if (windows.size > 5000) {
    for (const [k, times] of Array.from(windows)) {
      if (times.every((t) => now - t >= windowMs)) windows.delete(k);
    }
  }
  return true;
}
