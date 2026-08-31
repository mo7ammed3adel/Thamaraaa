import crypto from "crypto";
import {
  DEFAULT_SCREENSHOT_INTERVAL_MINUTES,
  DEFAULT_SCREENSHOT_RETENTION_DAYS,
  SCREENSHOT_INTERVAL_KEY,
  SCREENSHOT_RETENTION_KEY,
  normalizeScreenshotRetentionDays,
  screenshotRetentionCutoff,
  buildScreenshotStorageKey,
  generateEnrolmentToken,
  hashDeviceToken,
  normalizeScreenshotInterval,
} from "@/lib/deviceMonitoring";
import {
  countScreenshotsBefore,
  createMonitoredDevice,
  createScreenshotRecord,
  deleteDeviceById,
  deleteScreenshotsByIds,
  findScreenshotKeysBefore,
  findScreenshotKeysByIds,
  findAllDevicesWithOwner,
  findDeviceById,
  findDeviceByTokenHash,
  findEnrollableUsers,
  findScreenshotForView,
  findScreenshotKeysByDevice,
  findScreenshots,
  setDeviceStatus,
  touchDeviceLastSeen,
  updateDeviceOwnerAndLabel,
  updateDeviceTokenHash,
} from "@/server/repositories/deviceRepository";
import { deleteScreenshotFile, saveScreenshotFile } from "@/server/services/screenshotStorage";
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

/** How many days a screenshot is kept before the purge removes it. */
export async function getScreenshotRetentionDays(): Promise<number> {
  const row = await prisma.systemConfig.findUnique({ where: { key: SCREENSHOT_RETENTION_KEY } });
  if (!row) return DEFAULT_SCREENSHOT_RETENTION_DAYS;
  return normalizeScreenshotRetentionDays(row.value);
}

/** Super admin sets how long captures survive before they are purged. */
export async function setScreenshotRetentionDays(input: { actorRole: string; days: unknown }) {
  if (!isSuperAdmin(input.actorRole)) return { status: "forbidden" as const };

  const days = normalizeScreenshotRetentionDays(input.days);
  await prisma.systemConfig.upsert({
    where: { key: SCREENSHOT_RETENTION_KEY },
    update: { value: String(days) },
    create: { key: SCREENSHOT_RETENTION_KEY, value: String(days) },
  });
  return { status: "ok" as const, days };
}

/** Ceiling on one manual delete, so a crafted request cannot ask for the lot. */
const MAX_MANUAL_DELETE = 500;

/**
 * Deletes screenshots the super admin picked by hand. Like the retention purge,
 * the file goes before the row, so an interrupted delete leaves at worst a row
 * whose image is already gone rather than a file nothing points at. A file that
 * cannot be removed keeps its row, so nothing disappears from the dashboard
 * while its image is still sitting on disk.
 */
export async function deleteScreenshots(input: { actorRole: string; ids: unknown }) {
  if (!isSuperAdmin(input.actorRole)) return { status: "forbidden" as const };

  const ids = Array.isArray(input.ids)
    ? input.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (ids.length === 0) return { status: "no_ids" as const };
  if (ids.length > MAX_MANUAL_DELETE) return { status: "too_many" as const };

  const shots = await findScreenshotKeysByIds(ids);
  const removed: string[] = [];
  let failed = 0;
  for (const shot of shots) {
    try {
      await deleteScreenshotFile(shot.storageKey);
      removed.push(shot.id);
    } catch (error) {
      failed += 1;
      console.error("Screenshot delete failed for", shot.id, error);
    }
  }

  const result = removed.length > 0 ? await deleteScreenshotsByIds(removed) : { count: 0 };
  return { status: "ok" as const, deleted: result.count, failed };
}

/** Rows handled per pass, so one purge never loads an unbounded result set. */
const PURGE_BATCH_SIZE = 200;
/** Ceiling on batches per run — 40k captures is far more than a day accrues. */
const PURGE_MAX_BATCHES = 200;

/**
 * Deletes every screenshot past its retention window, file first and row after,
 * so a crash mid-purge can only ever leave a row whose file is already gone —
 * which the viewer already tolerates — never an orphaned file no row points to.
 * Idempotent: running it twice in a row simply finds nothing the second time.
 */
export async function purgeExpiredScreenshots(now: Date = new Date()) {
  const days = await getScreenshotRetentionDays();
  const cutoff = screenshotRetentionCutoff(days, now);

  let deleted = 0;
  let failed = 0;

  for (let batch = 0; batch < PURGE_MAX_BATCHES; batch += 1) {
    const expired = await findScreenshotKeysBefore(cutoff, PURGE_BATCH_SIZE);
    if (expired.length === 0) break;

    const removed: string[] = [];
    for (const shot of expired) {
      try {
        await deleteScreenshotFile(shot.storageKey);
        removed.push(shot.id);
      } catch (error) {
        // Keep the row so the next run retries this file rather than losing
        // track of it; one unreadable file must not stall the whole purge.
        failed += 1;
        console.error("Screenshot purge failed for", shot.id, error);
      }
    }

    if (removed.length === 0) break; // every file in the batch failed — stop looping on it
    const result = await deleteScreenshotsByIds(removed);
    deleted += result.count;
  }

  const remaining = await countScreenshotsBefore(cutoff);
  return { status: "ok" as const, retentionDays: days, cutoff, deleted, failed, remaining };
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

/**
 * Issues a fresh token for an existing device and invalidates the old one in the
 * same write. Use it when a token leaked or the employee lost it -- the device,
 * its owner and its screenshot history stay put; only the credential changes.
 * Returns the new plaintext token once, exactly like enrolment.
 */
export async function reissueDeviceToken(input: { actorRole: string; deviceId: string }) {
  if (!isSuperAdmin(input.actorRole)) return { status: "forbidden" as const };

  const device = await findDeviceById(input.deviceId);
  if (!device) return { status: "not_found" as const };

  const token = generateEnrolmentToken();
  await updateDeviceTokenHash(input.deviceId, hashDeviceToken(token));
  return { status: "ok" as const, token };
}

/**
 * Reassigns a device to another employee and/or renames it. Moving the owner
 * does NOT reissue the token: the same machine keeps reporting, its captures are
 * simply attributed to the new person from now on. Past screenshots keep the
 * userId they were stored with, so history is not silently rewritten.
 */
export async function updateDevice(input: {
  actorRole: string;
  deviceId: string;
  userId?: unknown;
  label?: unknown;
}) {
  if (!isSuperAdmin(input.actorRole)) return { status: "forbidden" as const };

  const device = await findDeviceById(input.deviceId);
  if (!device) return { status: "not_found" as const };

  const data: { userId?: string; label?: string | null } = {};

  if (input.userId !== undefined) {
    const userId = typeof input.userId === "string" ? input.userId.trim() : "";
    if (!userId) return { status: "missing_user" as const };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return { status: "user_not_found" as const };
    data.userId = userId;
  }

  if (input.label !== undefined) {
    const label = typeof input.label === "string" ? input.label.trim() : "";
    data.label = label ? label.slice(0, 80) : null;
  }

  if (Object.keys(data).length === 0) return { status: "no_changes" as const };

  const updated = await updateDeviceOwnerAndLabel(input.deviceId, data);
  return { status: "ok" as const, device: updated };
}

/**
 * Permanently removes a device and everything it captured. Files go first, then
 * the device row (its screenshot rows cascade), so an interrupted delete leaves
 * at worst orphaned rows the next call clears -- never files with nothing
 * pointing at them. A file that will not delete keeps the device, so the whole
 * thing does not half-vanish from the dashboard.
 */
export async function deleteDevice(input: { actorRole: string; deviceId: string }) {
  if (!isSuperAdmin(input.actorRole)) return { status: "forbidden" as const };

  const device = await findDeviceById(input.deviceId);
  if (!device) return { status: "not_found" as const };

  const shots = await findScreenshotKeysByDevice(input.deviceId);
  let failed = 0;
  for (const shot of shots) {
    try {
      await deleteScreenshotFile(shot.storageKey);
    } catch (error) {
      failed += 1;
      console.error("Screenshot file delete failed for", shot.id, error);
    }
  }
  if (failed > 0) return { status: "files_failed" as const, failed };

  await deleteDeviceById(input.deviceId);
  return { status: "ok" as const, deletedScreenshots: shots.length };
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
