import { prisma } from "@/lib/prisma";

export function findUnreadNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId, read: false },
    orderBy: { createdAt: "desc" },
  });
}

export function findNotificationOwner(notificationId: string) {
  return prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true },
  });
}

export function markNotificationRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}
