import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWarningEmail } from "@/lib/email";
import { pusherServer } from "@/lib/pusher";

// POST /api/warnings - Create a new warning
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;

    const body = await req.json();
    const { subject, message, severity, projectId, recipientRoles } = body;

    if (!message || !projectId) {
      return NextResponse.json({ error: "message and projectId required" }, { status: 400 });
    }

    // Prepare warning details
    const warning = await prisma.$transaction(async (tx) => {
      const w = await tx.warning.create({
        data: {
          subject: subject || "Warning",
          message,
          severity: severity || "Medium",
          projectId,
          senderUserId: user.id,
          senderRole: user.role,
          recipientRoles: JSON.stringify(recipientRoles || []),
        },
      });

      // Find all users involved with the project
      const project = await tx.project.findUnique({
        where: { id: projectId },
        include: {
          teamAssignments: { where: { status: "active" } },
        }
      });

      if (!project) throw new Error("Project not found");

      // Head Account Managers
      const hdAMs = await tx.user.findMany({ where: { role: "head_account_manager" } });

      const affectedUserIds = new Set<string>();
      if (project.accountManagerId) affectedUserIds.add(project.accountManagerId);
      if (project.headTechnicalId) affectedUserIds.add(project.headTechnicalId);
      if (project.headSeoId) affectedUserIds.add(project.headSeoId);
      hdAMs.forEach(h => affectedUserIds.add(h.id));
      project.teamAssignments.forEach(t => affectedUserIds.add(t.userId));
      
      // Remove sender from affected users to avoid Warning Popup for themselves
      affectedUserIds.delete(user.id);

      const affectedUserIdsArray = Array.from(affectedUserIds);

      if (affectedUserIdsArray.length > 0) {
        await tx.warningReceipt.createMany({
          data: affectedUserIdsArray.map(userId => ({
            warningId: w.id,
            userId,
            isRead: false
          }))
        });
      }

      await tx.projectLog.create({
        data: {
          projectId,
          userId: user.id,
          action: "warning_issued",
          details: `Warning issued: ${w.subject} (${w.severity})`
        }
      });

      return { warning: w, affectedUserIdsArray };
    });

    const { warning: w, affectedUserIdsArray } = warning;

    // Trigger Pusher & Email
    if (affectedUserIdsArray.length > 0) {
      const usersToNotify = await prisma.user.findMany({
        where: { id: { in: affectedUserIdsArray } }
      });

      const deliveryPromises = usersToNotify.map(async (u) => {
        // Pusher event on the user's own channel (matches existing convention used in deals/projects routes)
        if (pusherServer) {
          try {
            await pusherServer.trigger(`user-${u.id}`, "new-warning", {
              id: w.id,
              warningId: w.id,
              subject: w.subject,
              message: w.message,
              severity: w.severity,
              senderRole: w.senderRole,
              senderUserId: w.senderUserId,
              createdAt: w.createdAt,
            });
          } catch (e) {
            console.error("Pusher broadcast error", e);
          }
        }

        if (u.email) {
          const res = await sendWarningEmail(u.email, `Warning: ${w.subject}`, w.message, user.name);
          if (res.success) {
            await prisma.warningReceipt.update({
              where: { warningId_userId: { warningId: w.id, userId: u.id } },
              data: { deliveredViaEmail: true, emailSentAt: new Date() }
            });
          }
        }
      });

      // HIGH-04: actually await delivery so failures are observable and warning creation completes consistently
      await Promise.allSettled(deliveryPromises);
    }

    return NextResponse.json({ success: true, warning: { id: w.id, receiptsCreated: affectedUserIdsArray.length } });
  } catch (error: any) {
    console.error("Create Warning Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

// GET /api/warnings — returns the current user's unread warnings (with sender info).
// Shape matches what WarningPopup / GlobalWarningAlert consume so they can mount-load existing warnings.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string };

    const receipts = await prisma.warningReceipt.findMany({
      where: { userId: user.id, isRead: false, warning: { status: { not: "Resolved" } } },
      include: {
        warning: {
          include: { sender: { select: { id: true, name: true, role: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const warnings = receipts.map((r) => ({
      id: r.warning.id,
      subject: r.warning.subject,
      message: r.warning.message,
      severity: r.warning.severity,
      senderRole: r.warning.senderRole,
      senderUserId: r.warning.senderUserId,
      senderName: r.warning.sender?.name ?? "System",
      createdAt: r.warning.createdAt,
      userAcknowledged: false,
      receiptId: r.id,
    }));

    return NextResponse.json(warnings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Fetch Warnings Error:", message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
