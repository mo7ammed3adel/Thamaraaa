import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultChecklistForTaskType } from "@/lib/constants";

/** Roles allowed to create self-assigned tasks */
const SELF_TASK_ALLOWED_ROLES = [
  "agent_media_buyer",
  "agent_social_media",
  "agent_seo",
  "agent_content_seo",
  "agent_graphic_designer",
  "agent_motion_graphic",
  "agent_ui",
  "team_leader_media_buyer",
  "team_leader_social_media",
  "team_leader_seo",
  "head_seo",
  "leader_graphic_designer",
  "leader_motion_graphic",
  "leader_ui",
  "head_technical",
  "super_admin",
];

/**
 * POST /api/tasks/self
 *
 * Creates a task that is assigned to the requesting user themselves.
 * Both leaderId and agentId are set to the current user's ID.
 *
 * Required body: { projectId, brief, taskType }
 * Optional body: { priority, deadline }
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;

    if (!SELF_TASK_ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: "Your role is not permitted to create self-tasks" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { projectId, brief, priority, deadline, taskType } = body;

    if (!projectId || !brief?.trim()) {
      return NextResponse.json(
        { error: "Project ID and task brief are required" },
        { status: 400 }
      );
    }

    if (!taskType) {
      return NextResponse.json(
        { error: "Task type is required" },
        { status: 400 }
      );
    }

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        deal: { include: { lead: { select: { name: true } } } },
        teamAssignments: { where: { userId: user.id, status: "active" } },
        tasks: { where: { agentId: user.id }, select: { id: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check that the user is actually assigned to this project
    const hasAccess =
      user.role === "super_admin" ||
      project.teamAssignments.length > 0 ||
      project.tasks.length > 0;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You are not assigned to this project" },
        { status: 403 }
      );
    }

    const newTask = await prisma.task.create({
      data: {
        projectId,
        leaderId: user.id,
        agentId: user.id,
        taskType,
        brief: brief.trim(),
        priority: priority || "Medium",
        deadline: deadline ? new Date(deadline) : null,
        checklistItems: getDefaultChecklistForTaskType(taskType),
        requesterRole: user.role,
        assignedRole: user.role,
        status: "pending",
        progressPct: 0,
      },
    });

    // Log the self-task creation
    const projectName = project.deal?.lead?.name || "Unknown Project";
    await prisma.projectLog.create({
      data: {
        projectId,
        action: "task_created",
        details: JSON.stringify({
          description: `Self-task created by ${user.name}: "${brief.trim().substring(0, 60)}" for ${projectName}`,
          taskType,
          priority: priority || "Medium",
          selfAssigned: true,
        }),
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, task: newTask });
  } catch (error: any) {
    console.error("Failed to create self-task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
