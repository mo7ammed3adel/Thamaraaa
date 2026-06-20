import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backfillReceiptsForNewMember, checkProjectBlockers } from "@/lib/distribution";

/**
 * PATCH /api/projects/[id]/status
 * Updates project status, finalStatus, or notes.
 * 
 * Security: Only the assigned account manager, head account manager,
 * or super_admin can modify a project's status.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Ownership / Role Check ──
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true, accountManagerId: true, headTechnicalId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isOwner = project.accountManagerId === user.id;
    const isAdmin = ["super_admin", "head_account_manager"].includes(user.role);
    const isAssignedHeadTechnical = user.role === "head_technical" && project.headTechnicalId === user.id;

    if (!isOwner && !isAdmin && !isAssignedHeadTechnical) {
      return NextResponse.json({ error: "Forbidden: You are not authorized to modify this project." }, { status: 403 });
    }

    // ── Input Validation ──
    const body = await request.json();
    const { projectStatus, finalStatus, notes, details, accountManagerId } = body;

    const validStatuses = ["new", "setup", "assigned", "in_progress", "on_hold", "delayed", "completed", "cancelled"];

    if (projectStatus && !validStatuses.includes(projectStatus)) {
      return NextResponse.json({ error: `Invalid status: ${projectStatus}` }, { status: 400 });
    }

    if (accountManagerId !== undefined) {
      if (!["super_admin", "head_account_manager"].includes(user.role)) {
        return NextResponse.json({ error: "Only Head Account Manager can change account manager assignment." }, { status: 403 });
      }

      if (accountManagerId) {
        const targetAccountManager = await prisma.user.findUnique({
          where: { id: accountManagerId },
          select: { id: true, role: true, status: true },
        });

        if (!targetAccountManager || targetAccountManager.role !== "account_manager" || targetAccountManager.status !== "Active") {
          return NextResponse.json({ error: "Target account manager not found or inactive." }, { status: 400 });
        }
      }
    }

    const updateData: any = {};
    if (projectStatus) updateData.projectStatus = projectStatus;
    if (finalStatus) updateData.finalStatus = finalStatus;
    if (notes !== undefined) updateData.notes = notes;
    if (accountManagerId !== undefined) updateData.accountManagerId = accountManagerId || null;

    if (projectStatus && ["in_progress", "completed", "review"].includes(projectStatus)) {
      const blockers = await checkProjectBlockers(params.id);
      if (blockers.isBlocked) {
        return NextResponse.json({
          error: "Action blocked by unresolved warnings.",
          warnings: blockers.warnings,
        }, { status: 403 });
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: updateData,
    });

    // ── Audit Log ──
    if (projectStatus || finalStatus) {
      await prisma.projectLog.create({
        data: {
          projectId: params.id,
          action: "status_changed",
          details: details || `Status changed to ${projectStatus || finalStatus} by ${user.name || user.id}`,
          userId: user.id,
        },
      });
    }

    if (accountManagerId !== undefined && project.accountManagerId !== (accountManagerId || null)) {
      await prisma.projectLog.create({
        data: {
          projectId: params.id,
          action: "account_manager_changed",
          details: details || `Account Manager ${accountManagerId ? "assigned" : "unassigned"} by ${user.name || user.id}`,
          userId: user.id,
        },
      });

      if (accountManagerId) {
        await backfillReceiptsForNewMember(params.id, accountManagerId);
      }
    }

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Failed to update project status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
