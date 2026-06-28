import { prisma } from "@/lib/prisma";

export function findUnreadNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId, read: false },
    orderBy: { createdAt: "desc" },
  });
}

export function findMeetingLinkNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: {
      userId,
      link: { not: null },
      OR: [
        { type: "meeting_link" },
        { title: "Meeting Link Added" },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
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
