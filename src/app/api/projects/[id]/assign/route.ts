import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDistributeTo, backfillReceiptsForNewMember } from "@/lib/distribution";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: string };

  try {
    const body = await req.json();
    const { targetRole, assigneeId } = body;

    if (!targetRole || !assigneeId) {
      return NextResponse.json({ error: "targetRole and assigneeId required" }, { status: 400 });
    }

    // Authorization: caller's role must be allowed to distribute to targetRole per DISTRIBUTION_MAP.
    if (!canDistributeTo(user.role, targetRole)) {
      return NextResponse.json(
        { error: `Your role (${user.role}) cannot assign ${targetRole}` },
        { status: 403 }
      );
    }

    // Verify the assignee actually has the target role and is active.
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, role: true, status: true },
    });
    if (!assignee || assignee.status !== "Active" || assignee.role !== targetRole) {
      return NextResponse.json({ error: "Invalid assignee for this role" }, { status: 400 });
    }

    const updateData: { accountManagerId?: string; headTechnicalId?: string; headSeoId?: string; projectStatus?: string; assignedAt?: Date } = {};
    let notificationMsg = "";

    if (targetRole === "account_manager") {
      updateData.accountManagerId = assigneeId;
      updateData.projectStatus = "assigned";
      updateData.assignedAt = new Date();
      notificationMsg = "assigned as Account Manager";
    } else if (targetRole === "head_technical") {
      updateData.headTechnicalId = assigneeId;
      notificationMsg = "assigned as Head Technical";
    } else if (targetRole === "head_seo") {
      updateData.headSeoId = assigneeId;
      notificationMsg = "assigned as Head SEO";
    } else {
      return NextResponse.json({ error: "Unsupported targetRole" }, { status: 400 });
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: updateData
    });

    // The newly-assigned manager should see any unresolved warnings on the project.
    await backfillReceiptsForNewMember(params.id, assigneeId);

    // Log the assignment
    await prisma.projectLog.create({
      data: {
        projectId: project.id,
        action: "assigned",
        details: `${targetRole.replace(/_/g, " ").toUpperCase()} assigned to ${assigneeId}`,
        userId: user.id
      }
    });

    return NextResponse.json({ success: true, project });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
