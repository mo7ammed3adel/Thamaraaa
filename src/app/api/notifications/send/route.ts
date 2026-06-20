import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { hasRole, MANAGEMENT_ROLES } from "@/lib/constants";
import { normalizeNotificationLink } from "@/lib/safe-url";

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
    if (!hasRole(sender.role, NOTIFICATION_SENDER_ROLES)) {
      return NextResponse.json({ error: "Forbidden: your role cannot send notifications" }, { status: 403 });
    }

    const { userId, title, message, link } = await req.json();

    if (!userId || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const safeLink = link ? normalizeNotificationLink(link) : null;
    if (link && !safeLink) {
      return NextResponse.json({ error: "Invalid notification link" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!targetUser || targetUser.status !== "Active") {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        link: safeLink,
        read: false
      }
    });

    await pusherServer.trigger(`user-${userId}`, "new-notification", notification);

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error("Failed to send notification:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
