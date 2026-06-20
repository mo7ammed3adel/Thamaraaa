import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backfillReceiptsForNewMember } from "@/lib/distribution";

/** Roles allowed to reassign a client between Account Managers */
const ALLOWED_ROLES = ["head_account_manager", "super_admin"];

/**
 * POST /api/projects/[id]/reassign-am
 * Transfers a client (project) from one Account Manager Agent to another.
 * Only the Head Account Manager or super_admin can perform this action.
 * All client history (notes, tasks, team assignments, warnings) is preserved.
 *
 * @param req - JSON body: { newAccountManagerId: string }
 * @param params.id - The project ID to reassign
 * @returns 200 with updated project on success
 * @returns 401 if not authenticated
 * @returns 403 if user is not Head AM or super_admin
 * @returns 400 if newAccountManagerId is missing, user not found, or user is not account_manager role
 * @returns 404 if project not found
 * @returns 500 on internal server error
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as { id: string; name: string; role: string };

    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: "Only the Head Account Manager can reassign clients" },
        { status: 403 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: { deal: { include: { lead: true } } },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const newAccountManagerId =
      typeof body.newAccountManagerId === "string"
        ? body.newAccountManagerId.trim()
        : "";

    if (!newAccountManagerId) {
      return NextResponse.json(
        { error: "newAccountManagerId is required" },
        { status: 400 }
      );
    }

    const newAM = await prisma.user.findUnique({
      where: { id: newAccountManagerId },
    });

    if (!newAM) {
      return NextResponse.json(
        { error: "Selected Account Manager not found" },
        { status: 400 }
      );
    }

    if (newAM.role !== "account_manager" || newAM.status !== "Active") {
      return NextResponse.json(
        { error: "Selected user is not an active Account Manager" },
        { status: 400 }
      );
    }

    const previousAMId = project.accountManagerId;

    const updatedProject = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: params.id },
        data: { accountManagerId: newAccountManagerId },
      });

      await tx.projectLog.create({
        data: {
          projectId: params.id,
          userId: user.id,
          action: "client_reassigned",
          details: `Client reassigned from ${previousAMId || "unassigned"} to ${newAM.name} by ${user.name}`,
        },
      });

      await tx.notification.create({
        data: {
          userId: newAccountManagerId,
          title: "Client Assigned",
          message: `Client "${project.deal?.lead?.name || project.id}" has been assigned to you by ${user.name}`,
          type: "client_reassigned",
          relatedId: params.id,
        },
      });

      if (previousAMId && previousAMId !== newAccountManagerId) {
        await tx.notification.create({
          data: {
            userId: previousAMId,
            title: "Client Reassigned",
            message: `Client "${project.deal?.lead?.name || project.id}" has been transferred to ${newAM.name} by ${user.name}`,
            type: "client_reassigned",
            relatedId: params.id,
          },
        });
      }

      return updated;
    });

    await backfillReceiptsForNewMember(params.id, newAccountManagerId);

    return NextResponse.json({ success: true, project: updatedProject });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Reassign AM Error:", message);
    return NextResponse.json(
      { error: "Internal Server Error", details: message },
      { status: 500 }
    );
  }
}
