import {
  createNotificationRecord,
  findAllNotificationsForUser,
  findMeetingLinkNotificationsForUser,
  findNotificationOwner,
  findNotificationTargetStatus,
  findUnreadNotificationsForUser,
  markNotificationRead,
} from "@/server/repositories/notificationRepository";
import { findLeadAssignedAgents } from "@/server/repositories/leadRepository";
import { hasRole, MANAGEMENT_ROLES } from "@/lib/constants";
import { normalizeNotificationLink } from "@/lib/safe-url";
import { canSalesAgentSendMeetingLink } from "@/lib/meetingLinkNotification";
import { canReceiveNotification } from "@/lib/notificationPolicy";
import { safeTrigger } from "@/lib/pusher";

// Only managerial / admin roles may push arbitrary notifications to other users.
// Other server-side flows create notifications directly — they don't go through this workflow.
const NOTIFICATION_SENDER_ROLES = [
  ...MANAGEMENT_ROLES,
  "hr_manager",
  "accountant",
  "tele_sales_manager",
  "sales_manager",
  "account_manager",
] as const;

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

/**
 * Manual user-to-user notification. Managers may notify anyone; a sales agent
 * may only push a meeting link to the tele agent of their own lead.
 */
export async function sendUserNotification(input: {
  sender: { id: string; role: string };
  body: any;
}) {
  const { sender } = input;
  const { userId, title, message, link, leadId, type, relatedId } = input.body;

  if (!userId || !title || !message) {
    return { status: "missing_fields" as const };
  }

  const safeLink = link ? normalizeNotificationLink(link) : null;
  if (link && !safeLink) {
    return { status: "invalid_link" as const };
  }

  const canSendManagerNotification = hasRole(sender.role, NOTIFICATION_SENDER_ROLES);
  let canSendMeetingLink = false;

  if (!canSendManagerNotification && leadId) {
    const lead = await findLeadAssignedAgents(leadId);

    canSendMeetingLink = canSalesAgentSendMeetingLink({
      senderRole: sender.role,
      senderId: sender.id,
      recipientId: userId,
      leadAssignedSalesAgentId: lead?.assignedSalesAgentId,
      leadAssignedTeleAgentId: lead?.assignedTeleAgentId,
      hasSafeLink: Boolean(safeLink),
    });
  }

  if (!canSendManagerNotification && !canSendMeetingLink) {
    return { status: "forbidden" as const };
  }

  const targetUser = await findNotificationTargetStatus(userId);
  if (!targetUser || !canReceiveNotification(targetUser.status)) {
    return { status: "target_not_found" as const };
  }

  const notification = await createNotificationRecord({
    userId,
    title,
    message,
    type: typeof type === "string" && type.trim() ? type.trim().slice(0, 64) : null,
    link: safeLink,
    relatedId: typeof relatedId === "string" && relatedId.trim() ? relatedId.trim().slice(0, 128) : null,
    read: false,
  });

  await safeTrigger(`user-${userId}`, "new-notification", notification);

  return { status: "ok" as const, notification };
}
