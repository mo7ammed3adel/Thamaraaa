import crypto from "crypto";

/**
 * Device monitoring primitives.
 *
 * The desktop agent authenticates with an enrolment token. Only the SHA-256 of
 * that token is stored, so a leak of the database does not hand out working
 * device credentials. Pure (crypto only, no IO) so it can be unit-tested.
 */

/** SystemConfig key holding the capture interval, in minutes. */
export const SCREENSHOT_INTERVAL_KEY = "screenshot_interval_minutes";

/** Fallback interval when the super admin has not set one. */
export const DEFAULT_SCREENSHOT_INTERVAL_MINUTES = 10;

/** Interval bounds: never hammer the device, never let it drift to hourly. */
export const MIN_SCREENSHOT_INTERVAL_MINUTES = 1;
export const MAX_SCREENSHOT_INTERVAL_MINUTES = 60;

/** A fresh enrolment token — 32 random bytes, URL-safe. Shown to the enroller once. */
export function generateEnrolmentToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** The stored form of a token. The plaintext is never persisted. */
export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Clamps a requested interval to the allowed range, rejecting non-numbers. */
export function normalizeScreenshotInterval(value: unknown): number {
  // Number(null) is 0 and Number("") is 0, so guard those before converting —
  // an absent value should fall back to the default, not to the minimum.
  if (value === null || value === undefined || value === "") {
    return DEFAULT_SCREENSHOT_INTERVAL_MINUTES;
  }
  const minutes = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(minutes)) return DEFAULT_SCREENSHOT_INTERVAL_MINUTES;
  const rounded = Math.round(minutes);
  return Math.min(MAX_SCREENSHOT_INTERVAL_MINUTES, Math.max(MIN_SCREENSHOT_INTERVAL_MINUTES, rounded));
}

/**
 * The storage key for one screenshot, namespaced by user and day so a folder
 * never holds an unbounded number of files and a day's captures are easy to
 * find or purge. The extension is fixed to .jpg — the agent uploads JPEG.
 * @param userId  Owner of the device
 * @param capturedAt When the shot was taken
 * @param id      The screenshot row id, guaranteeing uniqueness
 */
export function buildScreenshotStorageKey(userId: string, capturedAt: Date, id: string): string {
  const day = capturedAt.toISOString().slice(0, 10); // YYYY-MM-DD
  return `${userId}/${day}/${id}.jpg`;
}

/** A storage key the server generated is safe; anything else must be rejected. */
export function isSafeStorageKey(key: string): boolean {
  return /^[A-Za-z0-9_-]+\/\d{4}-\d{2}-\d{2}\/[A-Za-z0-9-]+\.jpg$/.test(key);
}

/** SystemConfig key holding how many days a screenshot is kept before purging. */
export const SCREENSHOT_RETENTION_KEY = "screenshot_retention_days";

/**
 * Fallback retention when the super admin has not set one. Screenshots can
 * catch passwords and private messages, so they expire by default rather than
 * accumulating for ever.
 */
export const DEFAULT_SCREENSHOT_RETENTION_DAYS = 30;

/** Retention bounds: at least a day to review, at most a year to hold. */
export const MIN_SCREENSHOT_RETENTION_DAYS = 1;
export const MAX_SCREENSHOT_RETENTION_DAYS = 365;

/** Clamps a requested retention to the allowed range, rejecting non-numbers. */
export function normalizeScreenshotRetentionDays(value: unknown): number {
  // Same guard as the interval: Number(null) and Number("") are 0, which would
  // silently clamp an absent value to the minimum instead of the default.
  if (value === null || value === undefined || value === "") {
    return DEFAULT_SCREENSHOT_RETENTION_DAYS;
  }
  const days = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(days)) return DEFAULT_SCREENSHOT_RETENTION_DAYS;
  const rounded = Math.round(days);
  return Math.min(MAX_SCREENSHOT_RETENTION_DAYS, Math.max(MIN_SCREENSHOT_RETENTION_DAYS, rounded));
}

/**
 * The instant before which a screenshot has outlived its retention. Anything
 * captured earlier than this is due for deletion.
 * @param days Retention window, already normalized
 * @param now  Reference time — injectable so the rule is testable
 */
export function screenshotRetentionCutoff(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
