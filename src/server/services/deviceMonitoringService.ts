import crypto from "crypto";
import {
  DEFAULT_SCREENSHOT_INTERVAL_MINUTES,
  SCREENSHOT_INTERVAL_KEY,
  buildScreenshotStorageKey,
  generateEnrolmentToken,
  hashDeviceToken,
  normalizeScreenshotInterval,
} from "@/lib/deviceMonitoring";
import {
  createMonitoredDevice,
  createScreenshotRecord,
  findAllDevicesWithOwner,
  findDeviceById,
  findDeviceByTokenHash,
  findEnrollableUsers,
  findScreenshotForView,
  findScreenshots,
  setDeviceStatus,
  touchDeviceLastSeen,
} from "@/server/repositories/deviceRepository";
import { saveScreenshotFile } from "@/server/services/screenshotStorage";
import { prisma } from "@/lib/prisma";

/** Only the super admin manages devices and views screenshots. */
function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "super_admin";
}

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5 MB per capture

/** The capture interval the agents should use, in minutes. */
export async function getScreenshotInterval(): Promise<number> {
  const row = await prisma.systemConfig.findUnique({ where: { key: SCREENSHOT_INTERVAL_KEY } });
  if (!row) return DEFAULT_SCREENSHOT_INTERVAL_MINUTES;
  return normalizeScreenshotInterval(row.value);
}

/** Super admin sets the interval every enrolled agent will poll for. */
export async function setScreenshotInterval(input: { actorRole: string; minutes: unknown }) {
  if (!isSuperAdmin(input.actorRole)) return { status: "forbidden" as const };

  const minutes = normalizeScreenshotInterval(input.minutes);
  await prisma.systemConfig.upsert({
    where: { key: SCREENSHOT_INTERVAL_KEY },
    update: { value: String(minutes) },
    create: { key: SCREENSHOT_INTERVAL_KEY, value: String(minutes) },
  });
  return { status: "ok" as const, minutes };
}

/**
 * Enrols a device for an employee. Returns the plaintext token exactly once —
 * only its hash is stored — so it can be pasted into the agent on that machine.
 */
export async function enrolDevice(input: {
  actor: { id: string; role: string };
  userId: unknown;
  label: unknown;
  hostname: unknown;
  platform: unknown;
}) {
  if (!isSuperAdmin(input.actor.role)) return { status: "forbidden" as const };

  const userId = typeof input.userId === "string" ? input.userId.trim() : "";
  if (!userId) return { status: "missing_user" as const };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
  if (!user) return { status: "user_not_found" as const };

  const token = generateEnrolmentToken();
  const device = await createMonitoredDevice({
    userId,
    label: typeof input.label === "string" && input.label.trim() ? input.label.trim().slice(0, 80) : null,
    hostname: typeof input.hostname === "string" ? input.hostname.trim().slice(0, 120) : null,
    platform: typeof input.platform === "string" ? input.platform.trim().slice(0, 20) : null,
    tokenHash: hashDeviceToken(token),
    enrolledByUserId: input.actor.id,
  });

  return { status: "ok" as const, device, token };
}

/** Pauses or resumes a device, or revokes it permanently. */
export async function changeDeviceStatus(input: {
  actorRole: string;
  deviceId: string;
  status: unknown;
}) {
  if (!isSuperAdmin(input.actorRole)) return { status: "forbidden" as const };

  const next = input.status;
  if (next !== "Active" && next !== "Paused" && next !== "Revoked") {
    return { status: "invalid_status" as const };
  }

  const device = await findDeviceById(input.deviceId);
  if (!device) return { status: "not_found" as const };

  const updated = await setDeviceStatus(input.deviceId, next);
  return { status: "ok" as const, device: updated };
}

export async function listDevices(actorRole: string) {
  if (!isSuperAdmin(actorRole)) return { status: "forbidden" as const };
  const devices = await findAllDevicesWithOwner();
  return { status: "ok" as const, devices };
}

export async function listEnrollableUsers(actorRole: string) {
  if (!isSuperAdmin(actorRole)) return { status: "forbidden" as const };
  const users = await findEnrollableUsers();
  return { status: "ok" as const, users };
}

/**
 * The agent's authenticated heartbeat: it presents its token, and gets back the
 * interval to use and whether it should keep capturing. A Paused device is told
 * to hold; a Revoked or unknown token is rejected outright.
 */
export async function agentCheckIn(token: string) {
  const device = await findDeviceByTokenHash(hashDeviceToken(token));
  if (!device || device.status === "Revoked") return { status: "unauthorized" as const };

  await touchDeviceLastSeen(device.id);
  const intervalMinutes = await getScreenshotInterval();

  return {
    status: "ok" as const,
    device,
    capturing: device.status === "Active",
    intervalMinutes,
  };
}

/**
 * Receives one screenshot from an authenticated agent, stores the file outside
 * the web root and records the row. A Paused or Revoked device is refused, so a
 * paused agent that keeps sending is simply ignored.
 */
export async function ingestScreenshot(input: {
  token: string;
  image: Buffer;
  capturedAt: unknown;
  width: unknown;
  height: unknown;
}) {
  if (!input.image || input.image.length === 0) return { status: "empty_image" as const };
  if (input.image.length > MAX_SCREENSHOT_BYTES) return { status: "too_large" as const };

  const device = await findDeviceByTokenHash(hashDeviceToken(input.token));
  if (!device || device.status !== "Active") return { status: "unauthorized" as const };

  await touchDeviceLastSeen(device.id);

  const capturedAt = parseDate(input.capturedAt) ?? new Date();
  const id = crypto.randomUUID();
  const storageKey = buildScreenshotStorageKey(device.userId, capturedAt, id);

  await saveScreenshotFile(storageKey, input.image);
  const record = await createScreenshotRecord({
    id,
    deviceId: device.id,
    userId: device.userId,
    storageKey,
    width: toIntOrNull(input.width),
    height: toIntOrNull(input.height),
    sizeBytes: input.image.length,
    capturedAt,
  });

  return { status: "ok" as const, screenshot: record };
}

const PAGE_SIZE = 60;

/** A page of screenshots for the super admin's review screen. */
export async function listScreenshots(input: {
  actorRole: string;
  userId?: string | null;
  deviceId?: string | null;
  from?: string | null;
  to?: string | null;
  page?: number;
}) {
  if (!isSuperAdmin(input.actorRole)) return { status: "forbidden" as const };

  const page = Math.max(1, input.page ?? 1);
  const [screenshots, total] = await findScreenshots({
    userId: input.userId || undefined,
    deviceId: input.deviceId || undefined,
    from: parseDate(input.from) ?? undefined,
    to: parseDate(input.to) ?? undefined,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });

  return {
    status: "ok" as const,
    screenshots,
    pagination: { page, pageSize: PAGE_SIZE, total, pages: Math.ceil(total / PAGE_SIZE) },
  };
}

/** The storage key for one screenshot, gated on the super-admin role. */
export async function getScreenshotForView(input: { actorRole: string; id: string }) {
  if (!isSuperAdmin(input.actorRole)) return { status: "forbidden" as const };
  const shot = await findScreenshotForView(input.id);
  if (!shot) return { status: "not_found" as const };
  return { status: "ok" as const, storageKey: shot.storageKey };
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIntOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}
