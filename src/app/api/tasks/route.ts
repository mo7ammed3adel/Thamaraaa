import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findTeamLeaderRoleForTaskType, userCanAccessProject } from "@/lib/distribution";
import { CROSS_TEAM_TASK_TYPES, AGENT_ASSIGNER_ROLES, MANAGEMENT_ROLES, ACCOUNT_MANAGER_ROLES, hasRole, getDefaultChecklistForTaskType } from "@/lib/constants";

// Roles that may create tasks. Includes:
//  - Team leaders / heads who orchestrate the work (AGENT_ASSIGNER_ROLES, MANAGEMENT_ROLES)
//  - Account managers who initiate cross-team requests
//  - Cross-team requesting agents (social media, media buyer, SEO) per spec
const TASK_CREATOR_ROLES = [
  ...AGENT_ASSIGNER_ROLES,
  ...MANAGEMENT_ROLES,
  ...ACCOUNT_MANAGER_ROLES,
  "agent_social_media",
  "agent_media_buyer",
  "agent_seo",
  "agent_content_seo",
] as const;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as { id: string; role: string; name?: string };

    if (!hasRole(user.role, TASK_CREATOR_ROLES)) {
      return NextResponse.json({ error: "Forbidden: your role cannot create tasks" }, { status: 403 });
    }

    const body = await req.json();
    const { projectId, leaderId, assignedRole, taskType, priority, brief, taskLink, deadline, checklistItems } = body;

    if (!projectId || !taskType) {
      return NextResponse.json({ error: "projectId and taskType are required" }, { status: 400 });
    }

    // The user must already be a stakeholder of the project they're creating a task for.
    const projectAllowed = await userCanAccessProject(user.id, user.role, projectId);
    if (!projectAllowed) {
      return NextResponse.json({ error: "Forbidden: you are not on this project" }, { status: 403 });
    }

    let finalLeaderId = leaderId;
    let finalAssignedRole = assignedRole;

    const isCrossTeam = CROSS_TEAM_TASK_TYPES.includes(taskType);

    if (isCrossTeam && !finalLeaderId) {
      const leaderRole = findTeamLeaderRoleForTaskType(taskType);
      if (leaderRole) {
        const projectLeader = await prisma.teamAssignment.findFirst({
          where: {
            projectId,
            role: leaderRole,
            status: "active",
            user: { status: "Active" },
          },
          select: { userId: true },
        });
        const leader = projectLeader
          ? { id: projectLeader.userId }
          : await prisma.user.findFirst({ where: { role: leaderRole, status: "Active" }, select: { id: true } });
        if (leader) {
          finalLeaderId = leader.id;
          finalAssignedRole = leaderRole;
        }
      }
      // Fallback: assign to super_admin if no specific leader found
      if (!finalLeaderId) {
        const admin = await prisma.user.findFirst({ where: { role: "super_admin", status: "Active" } });
        if (admin) {
          finalLeaderId = admin.id;
          finalAssignedRole = "super_admin";
        }
      }
    } else if (!finalLeaderId) {
      let roleToFind = "super_admin"; // fallback
      switch (taskType) {
        case "seo":
        case "content_seo":
          roleToFind = "head_seo"; // or team_leader_seo
          break;
        case "social_media":
          roleToFind = "team_leader_social_media";
          break;
        case "media_buyer":
          roleToFind = "team_leader_media_buyer";
          break;
        case "technical":
          roleToFind = "head_technical";
          break;
      }
      
      const leader = await prisma.user.findFirst({ where: { role: { in: ["team_leader_seo"].includes(roleToFind) ? ["head_seo", "team_leader_seo"] : [roleToFind, "super_admin"] }, status: "Active" } });
      if (leader) finalLeaderId = leader.id;
    }

    if (!projectId || !finalLeaderId || !taskType) {
      return NextResponse.json({ error: `Cannot find a leader for task type "${taskType}". Please ensure a leader with the correct role exists in the system.` }, { status: 400 });
    }

    // Get project name for logging
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { deal: { include: { lead: true } } }
    });

    const projectName = project?.deal?.lead?.name || "Unknown Project";

    const newTask = await prisma.task.create({
      data: {
        projectId,
        leaderId: finalLeaderId,
        assignedRole: finalAssignedRole || null,
        taskType,
        brief: brief || "",
        taskLink: taskLink || null,
        priority: priority || "Medium",
        deadline: deadline ? new Date(deadline) : null,
        checklistItems: checklistItems || getDefaultChecklistForTaskType(taskType),
        requesterRole: user.role,
        status: "pending",
        progressPct: 0
      }
    });

    if (isCrossTeam) {
      await prisma.projectLog.create({
        data: {
          projectId,
          action: "task_created",
          details: JSON.stringify({
            description: `Cross-team task created: ${taskType.replace(/_/g, " ")} for ${projectName}`,
            taskType,
            priority: priority || "Medium"
          }),
          userId: user.id
        }
      });

      await prisma.notification.create({
        data: {
          userId: finalLeaderId,
          type: "task_assigned",
          title: "Cross-Team Task Request",
          message: `A new ${taskType.replace(/_/g, " ")} task has been requested by ${user.name} for ${projectName}`,
          link: "/dashboard/operations"
        }
      });

      try {
        const { pusherServer } = await import("@/lib/pusher");
        if (pusherServer) {
          await pusherServer.trigger(`private-user-${finalLeaderId}`, "task-assigned", {
            projectId,
            taskId: newTask.id
          });
          await pusherServer.trigger(`private-project-${projectId}`, "task-status-changed", {
            taskId: newTask.id,
            status: "pending"
          });
        }
      } catch (err) {
        console.error("Pusher error in cross-team task:", err);
      }
    }

    return NextResponse.json({ success: true, task: newTask });
  } catch (error: any) {
    console.error("Failed to create task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    const whereClause: any = {};
    if (projectId) whereClause.projectId = projectId;

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        leader: true,
        agent: true
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
