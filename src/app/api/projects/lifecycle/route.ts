import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateLifecycleTransition, canChangeLifecycle } from "@/lib/lifecycle";

/**
 * PATCH /api/projects/lifecycle
 * Changes a project's lifecycle state with role-based authorization and state-machine validation.
 * Body: { projectId: string, newState: string }
 * Allowed roles: account_manager (own projects only), head_account_manager, super_admin
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; name: string };

    const body = await req.json();
    const { projectId, newState } = body;

    if (!projectId || !newState) {
      return NextResponse.json(
        { error: "projectId and newState are required" },
        { status: 400 }
      );
    }

    // Fetch the project with current lifecycle state
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, lifecycleState: true, accountManagerId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Authorization check
    if (!canChangeLifecycle(user.role, user.id, project.accountManagerId)) {
      return NextResponse.json(
        { error: "You are not authorized to change this project's lifecycle state" },
        { status: 403 }
      );
    }

    // State machine validation
    const validation = validateLifecycleTransition(project.lifecycleState, newState);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 422 });
    }

    // Perform the update + audit log in a transaction
    const [updatedProject] = await prisma.$transaction([
      prisma.project.update({
        where: { id: projectId },
        data: { lifecycleState: newState },
      }),
      prisma.projectLog.create({
        data: {
          projectId,
          action: "lifecycle_changed",
          details: JSON.stringify({
            from: project.lifecycleState,
            to: newState,
            changedBy: user.name,
            changedByRole: user.role,
          }),
          userId: user.id,
        },
      }),
    ]);

    // Trigger real-time notification
    try {
      const { pusherServer } = await import("@/lib/pusher");
      if (pusherServer) {
        await pusherServer.trigger("projects-channel", "lifecycle-changed", {
          projectId,
          newState,
          changedBy: user.name,
        });
      }
    } catch (pusherError) {
      console.error("Pusher lifecycle broadcast error:", pusherError);
    }

    return NextResponse.json({
      success: true,
      project: {
        id: updatedProject.id,
        lifecycleState: updatedProject.lifecycleState,
      },
    });
  } catch (error: unknown) {
    console.error("Lifecycle update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
