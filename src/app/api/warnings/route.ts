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

      const emailPromises = usersToNotify.map(async (u) => {
        // Pusher Event
        if (pusherServer) {
          try {
            await pusherServer.trigger(`private-user-${u.id}`, "warning-issued", {
              warningId: w.id,
              severity: w.severity
            });
          } catch (e) {
            console.error("Pusher broadcast error", e);
          }
        }

        // Email Send
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

      Promise.allSettled(emailPromises);
    }

    return NextResponse.json({ success: true, warning: { id: w.id, receiptsCreated: affectedUserIdsArray.length } });
  } catch (error: any) {
    console.error("Create Warning Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Legacy GET required by existing components maybe?
  // I will just return an empty array if not immediately needed since the unread is fetched now.
  return NextResponse.json([]);
}
