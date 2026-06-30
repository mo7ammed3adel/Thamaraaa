import {
  findAllNotificationsForUser,
  findMeetingLinkNotificationsForUser,
  findNotificationOwner,
  findUnreadNotificationsForUser,
  markNotificationRead,
} from "@/server/repositories/notificationRepository";

export async function listUnreadNotifications(userId: string) {
  return findUnreadNotificationsForUser(userId);
}

export async function listAllNotifications(userId: string) {
  return findAllNotificationsForUser(userId);
}

export async function listMeetingLinkNotifications(userId: string) {
  return findMeetingLinkNotificationsForUser(userId);
}

export async function markNotificationReadForUser(notificationId: string, userId: string): Promise<boolean> {
  const notification = await findNotificationOwner(notificationId);
  if (!notification || notification.userId !== userId) {
    return false;
  }

  await markNotificationRead(notification.id);
  return true;
}
