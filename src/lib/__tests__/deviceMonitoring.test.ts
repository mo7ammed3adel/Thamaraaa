import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCREENSHOT_INTERVAL_MINUTES,
  MAX_SCREENSHOT_INTERVAL_MINUTES,
  MIN_SCREENSHOT_INTERVAL_MINUTES,
  buildScreenshotStorageKey,
  generateEnrolmentToken,
  hashDeviceToken,
  isSafeStorageKey,
  normalizeScreenshotInterval,
} from "@/lib/deviceMonitoring";

describe("enrolment tokens", () => {
  it("generates a distinct, hard-to-guess token each time", () => {
    const a = generateEnrolmentToken();
    const b = generateEnrolmentToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes a token deterministically and irreversibly", () => {
    const token = generateEnrolmentToken();
    expect(hashDeviceToken(token)).toBe(hashDeviceToken(token));
    expect(hashDeviceToken(token)).not.toContain(token);
    expect(hashDeviceToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("normalizeScreenshotInterval", () => {
  it("clamps to the allowed range", () => {
    expect(normalizeScreenshotInterval(0)).toBe(MIN_SCREENSHOT_INTERVAL_MINUTES);
    expect(normalizeScreenshotInterval(1000)).toBe(MAX_SCREENSHOT_INTERVAL_MINUTES);
    expect(normalizeScreenshotInterval(5)).toBe(5);
  });

  it("accepts a numeric string", () => {
    expect(normalizeScreenshotInterval("15")).toBe(15);
  });

  it("falls back to the default for a non-number", () => {
    expect(normalizeScreenshotInterval("abc")).toBe(DEFAULT_SCREENSHOT_INTERVAL_MINUTES);
    expect(normalizeScreenshotInterval(null)).toBe(DEFAULT_SCREENSHOT_INTERVAL_MINUTES);
  });

  it("rounds fractional minutes", () => {
    expect(normalizeScreenshotInterval(4.6)).toBe(5);
  });
});

describe("storage keys", () => {
  it("namespaces a key by user and capture day", () => {
    const key = buildScreenshotStorageKey("user-1", new Date("2026-08-31T09:15:00Z"), "shot-1");
    expect(key).toBe("user-1/2026-08-31/shot-1.jpg");
  });

  it("accepts a key it generated and rejects a traversal attempt", () => {
    const key = buildScreenshotStorageKey("user-1", new Date("2026-08-31T00:00:00Z"), "shot-1");
    expect(isSafeStorageKey(key)).toBe(true);
    expect(isSafeStorageKey("../../etc/passwd")).toBe(false);
    expect(isSafeStorageKey("user-1/2026-08-31/shot-1.png")).toBe(false);
    expect(isSafeStorageKey("user-1/not-a-date/shot-1.jpg")).toBe(false);
  });
});
