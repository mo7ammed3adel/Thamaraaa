import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeTrigger } from "@/lib/pusher";
import { hasRole, MANAGEMENT_ROLES } from "@/lib/constants";
import { normalizeNotificationLink } from "@/lib/safe-url";
import { canSalesAgentSendMeetingLink } from "@/lib/meetingLinkNotification";
import { canReceiveNotification } from "@/lib/notificationPolicy";

// Only managerial / admin roles may push arbitrary notifications to other users.
// Other server-side flows create notifications directly via prisma — they don't go through this endpoint.
const NOTIFICATION_SENDER_ROLES = [
  ...MANAGEMENT_ROLES,
  "hr_manager",
  "accountant",
  "tele_sales_manager",
  "sales_manager",
  "account_manager",
] as const;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sender = session.user as { id: string; role: string };
    const { userId, title, message, link, leadId, type, relatedId } = await req.json();

    if (!userId || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const safeLink = link ? normalizeNotificationLink(link) : null;
    if (link && !safeLink) {
      return NextResponse.json({ error: "Invalid notification link" }, { status: 400 });
    }

    const canSendManagerNotification = hasRole(sender.role, NOTIFICATION_SENDER_ROLES);
    let canSendMeetingLink = false;

    if (!canSendManagerNotification && leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          assignedSalesAgentId: true,
          assignedTeleAgentId: true,
        },
      });

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
      return NextResponse.json({ error: "Forbidden: your role cannot send notifications" }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!targetUser || !canReceiveNotification(targetUser.status)) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type: typeof type === "string" && type.trim() ? type.trim().slice(0, 64) : null,
        link: safeLink,
        relatedId: typeof relatedId === "string" && relatedId.trim() ? relatedId.trim().slice(0, 128) : null,
        read: false
      }
    });

    await safeTrigger(`user-${userId}`, "new-notification", notification);

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error("Failed to send notification:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
