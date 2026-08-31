import { prisma } from "@/lib/prisma";

export function createMonitoredDevice(input: {
  userId: string;
  label: string | null;
  hostname: string | null;
  platform: string | null;
  tokenHash: string;
  enrolledByUserId: string;
}) {
  return prisma.monitoredDevice.create({
    data: {
      userId: input.userId,
      label: input.label,
      hostname: input.hostname,
      platform: input.platform,
      tokenHash: input.tokenHash,
      enrolledByUserId: input.enrolledByUserId,
    },
    select: { id: true, userId: true, label: true, status: true },
  });
}

/** The device behind an agent token — the hot path on every upload. */
export function findDeviceByTokenHash(tokenHash: string) {
  return prisma.monitoredDevice.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, status: true },
  });
}

export function touchDeviceLastSeen(deviceId: string) {
  return prisma.monitoredDevice.update({
    where: { id: deviceId },
    data: { lastSeenAt: new Date() },
    select: { id: true },
  });
}

export function setDeviceStatus(deviceId: string, status: string) {
  return prisma.monitoredDevice.update({
    where: { id: deviceId },
    data: { status },
    select: { id: true, status: true },
  });
}

export function findDeviceById(deviceId: string) {
  return prisma.monitoredDevice.findUnique({
    where: { id: deviceId },
    select: { id: true, userId: true, status: true, label: true },
  });
}

/** All devices, newest first, with their owner and a live screenshot count. */
export function findAllDevicesWithOwner() {
  return prisma.monitoredDevice.findMany({
    select: {
      id: true,
      label: true,
      hostname: true,
      platform: true,
      status: true,
      lastSeenAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, role: true } },
      _count: { select: { screenshots: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function createScreenshotRecord(input: {
  id: string;
  deviceId: string;
  userId: string;
  storageKey: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  capturedAt: Date;
}) {
  return prisma.screenshot.create({
    data: input,
    select: { id: true, storageKey: true, capturedAt: true },
  });
}

/** One page of screenshots, filterable by employee, device or day. */
export function findScreenshots(input: {
  userId?: string;
  deviceId?: string;
  from?: Date;
  to?: Date;
  take: number;
  skip: number;
}) {
  const where: Record<string, unknown> = {};
  if (input.userId) where.userId = input.userId;
  if (input.deviceId) where.deviceId = input.deviceId;
  if (input.from || input.to) {
    where.capturedAt = {
      ...(input.from ? { gte: input.from } : {}),
      ...(input.to ? { lte: input.to } : {}),
    };
  }

  return prisma.$transaction([
    prisma.screenshot.findMany({
      where,
      select: {
        id: true,
        storageKey: true,
        capturedAt: true,
        width: true,
        height: true,
        device: { select: { id: true, label: true } },
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { capturedAt: "desc" },
      take: input.take,
      skip: input.skip,
    }),
    prisma.screenshot.count({ where }),
  ]);
}

/** One screenshot's storage key, for streaming the image back to a reviewer. */
export function findScreenshotForView(id: string) {
  return prisma.screenshot.findUnique({
    where: { id },
    select: { id: true, storageKey: true },
  });
}

/** Deletes screenshot rows older than a cutoff and returns how many. */
export function deleteScreenshotsBefore(cutoff: Date) {
  return prisma.screenshot.deleteMany({ where: { capturedAt: { lt: cutoff } } });
}

/** Storage keys older than a cutoff, so their files can be removed from disk. */
export function findScreenshotKeysBefore(cutoff: Date, take: number) {
  return prisma.screenshot.findMany({
    where: { capturedAt: { lt: cutoff } },
    select: { id: true, storageKey: true },
    orderBy: { capturedAt: "asc" },
    take,
  });
}

/** Storage keys for a specific set of screenshots, so a manual delete can
 * remove the files before the rows. */
export function findScreenshotKeysByIds(ids: string[]) {
  return prisma.screenshot.findMany({
    where: { id: { in: ids } },
    select: { id: true, storageKey: true },
  });
}

/** Drops exactly the rows whose files the purge has already removed. */
export function deleteScreenshotsByIds(ids: string[]) {
  return prisma.screenshot.deleteMany({ where: { id: { in: ids } } });
}

/** How many screenshots are currently past their retention window. */
export function countScreenshotsBefore(cutoff: Date) {
  return prisma.screenshot.count({ where: { capturedAt: { lt: cutoff } } });
}

/** Active employees the super admin can enrol a device for. */
export function findEnrollableUsers() {
  return prisma.user.findMany({
    where: { status: "Active", role: { not: "super_admin" } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}
