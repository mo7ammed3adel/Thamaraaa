import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backfillReceiptsForNewMember, canDistributeTo, canReassignTask } from "@/lib/distribution";

const TASK_AGENT_ROLE_MAP: Record<string, string[]> = {
  SEO: ["agent_seo"],
  seo: ["agent_seo"],
  content_seo: ["agent_content_seo"],
  Social_Media: ["agent_social_media"],
  social_media: ["agent_social_media"],
  Media_Buyer: ["agent_media_buyer"],
  media_buyer: ["agent_media_buyer"],
  media_buying: ["agent_media_buyer"],
  graphic_design: ["agent_graphic_designer"],
  motion_graphic: ["agent_motion_graphic"],
  ui_design: ["agent_ui"],
};

const AGENT_DEPARTMENT_MAP: Record<string, string> = {
  agent_seo: "seo",
  agent_content_seo: "content_seo",
  agent_social_media: "social_media",
  agent_media_buyer: "media_buyer",
  agent_graphic_designer: "graphic_design",
  agent_motion_graphic: "motion_graphic",
  agent_ui: "ui_design",
};

/**
 * POST /api/tasks/[id]/reassign
 * Allows a Team Leader to reassign a task to a different agent within their team.
 * - Validates the user has a Team Leader role
 * - Validates the new agent exists and has an appropriate role
 * - Updates agentId to the new agent
 * - Clears any previous flag data
 * - Creates notifications for both old and new agents
 *
 * @param req - JSON body: { newAgentId: string }
 * @param params.id - The task ID to reassign
 * @returns 200 with updated task on success
 * @returns 401 if not authenticated
 * @returns 403 if user is not a Team Leader
 * @returns 400 if newAgentId is missing or agent not found
 * @returns 404 if task not found
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

    if (!canReassignTask(user.role)) {
      return NextResponse.json(
        { error: "Only Team Leaders can reassign tasks" },
        { status: 403 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: { project: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (user.role !== "super_admin" && task.leaderId !== user.id) {
      return NextResponse.json(
        { error: "You can only reassign tasks you lead" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const newAgentId =
      typeof body.newAgentId === "string" ? body.newAgentId.trim() : "";

    if (!newAgentId) {
      return NextResponse.json(
        { error: "newAgentId is required" },
        { status: 400 }
      );
    }

    const newAgent = await prisma.user.findUnique({
      where: { id: newAgentId },
      select: { id: true, name: true, role: true, status: true },
    });

    if (!newAgent || newAgent.status !== "Active") {
      return NextResponse.json(
        { error: "Selected agent not found or inactive" },
        { status: 400 }
      );
    }

    if (!canDistributeTo(user.role, newAgent.role)) {
      return NextResponse.json(
        { error: `Your role cannot reassign tasks to ${newAgent.role}` },
        { status: 403 }
      );
    }

    const allowedAgentRoles = TASK_AGENT_ROLE_MAP[task.taskType] || [];
    if (!allowedAgentRoles.includes(newAgent.role)) {
      return NextResponse.json(
        { error: `${newAgent.role} cannot receive ${task.taskType.replace(/_/g, " ")} tasks` },
        { status: 400 }
      );
    }

    const previousAgentId = task.agentId;
    const agentDepartment = AGENT_DEPARTMENT_MAP[newAgent.role];

    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: params.id },
        data: {
          agentId: newAgentId,
          flagReason: null,
          flaggedAt: null,
          flaggedByUserId: null,
          status: task.status === "done" ? "done" : "pending",
        },
      });

      if (agentDepartment) {
        await tx.teamAssignment.upsert({
          where: { projectId_userId: { projectId: task.projectId, userId: newAgentId } },
          update: {
            role: newAgent.role,
            department: agentDepartment,
            status: "active",
            removedAt: null,
            assignedByUserId: user.id,
          },
          create: {
            projectId: task.projectId,
            userId: newAgentId,
            assignedByUserId: user.id,
            role: newAgent.role,
            department: agentDepartment,
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: newAgentId,
          title: "Task Assigned",
          message: `You have been assigned task "${task.taskType}" by ${user.name}`,
          type: "task_reassigned",
          relatedId: task.id,
        },
      });

      if (previousAgentId && previousAgentId !== newAgentId) {
        await tx.notification.create({
          data: {
            userId: previousAgentId,
            title: "Task Reassigned",
            message: `Task "${task.taskType}" has been reassigned to another agent by ${user.name}`,
            type: "task_reassigned",
            relatedId: task.id,
          },
        });
      }

      if (task.projectId) {
        await tx.projectLog.create({
          data: {
            projectId: task.projectId,
            userId: user.id,
            action: "task_reassigned",
            details: `Task "${task.taskType}" reassigned to ${newAgent.name} by ${user.name}`,
          },
        });
      }

      return updated;
    });

    await backfillReceiptsForNewMember(task.projectId, newAgentId);

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Reassign Task Error:", message);
    return NextResponse.json(
      { error: "Internal Server Error", details: message },
      { status: 500 }
    );
  }
}
