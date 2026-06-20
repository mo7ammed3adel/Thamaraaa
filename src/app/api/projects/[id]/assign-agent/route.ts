import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDistributeTo, backfillReceiptsForNewMember } from "@/lib/distribution";

const DEPARTMENT_AGENT_CONFIG: Record<string, { taskTypes: string[]; agentRoles: string[]; dashboardLink: string }> = {
  seo: {
    taskTypes: ["SEO", "seo"],
    agentRoles: ["agent_seo"],
    dashboardLink: "/dashboard/seo",
  },
  content_seo: {
    taskTypes: ["content_seo"],
    agentRoles: ["agent_content_seo"],
    dashboardLink: "/dashboard/seo",
  },
  social_media: {
    taskTypes: ["Social_Media", "social_media"],
    agentRoles: ["agent_social_media"],
    dashboardLink: "/dashboard/social-media",
  },
  media_buyer: {
    taskTypes: ["Media_Buyer", "media_buyer", "media_buying"],
    agentRoles: ["agent_media_buyer"],
    dashboardLink: "/dashboard/media-buyer",
  },
  graphic_design: {
    taskTypes: ["graphic_design"],
    agentRoles: ["agent_graphic_designer"],
    dashboardLink: "/dashboard/design",
  },
  motion_graphic: {
    taskTypes: ["motion_graphic"],
    agentRoles: ["agent_motion_graphic"],
    dashboardLink: "/dashboard/design",
  },
  ui_design: {
    taskTypes: ["ui_design"],
    agentRoles: ["agent_ui"],
    dashboardLink: "/dashboard/design",
  },
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; name: string };
    
    // Authorization
    const allowedRoles = [
      "team_leader_social_media", 
      "team_leader_media_buyer", 
      "team_leader_seo", 
      "leader_graphic_designer", 
      "leader_motion_graphic", 
      "leader_ui", 
      "super_admin"
    ];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden: role not allowed" }, { status: 403 });
    }

    const body = await req.json();
    const { agentUserId, department } = body;

    if (!agentUserId || !department) {
      return NextResponse.json(
        { error: "agentUserId and department are required" },
        { status: 400 }
      );
    }

    const deptConfig = DEPARTMENT_AGENT_CONFIG[department];
    if (!deptConfig) {
      return NextResponse.json(
        { error: `Unknown department: ${department}` },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: agentUserId },
      select: { id: true, role: true, name: true, status: true },
    });

    if (!targetUser || targetUser.status !== "Active") {
      return NextResponse.json(
        { error: "Target user not found or inactive" },
        { status: 404 }
      );
    }

    if (!canDistributeTo(user.role, targetUser.role)) {
      return NextResponse.json(
        { error: `Your role (${user.role}) cannot distribute to ${targetUser.role}` },
        { status: 403 }
      );
    }

    if (!deptConfig.agentRoles.includes(targetUser.role)) {
      return NextResponse.json(
        { error: `${targetUser.role} cannot receive ${department} tasks` },
        { status: 400 }
      );
    }

    // Check project exists
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        headTechnicalId: true,
        headSeoId: true,
        teamAssignments: {
          where: { userId: user.id, status: "active" },
          select: { id: true },
        },
        tasks: {
          where: { leaderId: user.id },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const canManageThisProject =
      user.role === "super_admin" ||
      project.headTechnicalId === user.id ||
      project.headSeoId === user.id ||
      project.teamAssignments.length > 0 ||
      project.tasks.length > 0;

    if (!canManageThisProject) {
      return NextResponse.json(
        { error: "Forbidden: you are not assigned to manage this project" },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.teamAssignment.deleteMany({
        where: {
          projectId: params.id,
          department,
          status: "active",
          role: { in: deptConfig.agentRoles },
          userId: { not: agentUserId },
        },
      });

      const existingAssignment = await tx.teamAssignment.findUnique({
        where: { projectId_userId: { projectId: params.id, userId: agentUserId } },
      });

      const assignment = existingAssignment
        ? await tx.teamAssignment.update({
            where: { id: existingAssignment.id },
            data: {
              assignedByUserId: user.id,
              role: targetUser.role,
              department,
              status: "active",
              removedAt: null,
            },
          })
        : await tx.teamAssignment.create({
            data: {
              projectId: params.id,
              userId: agentUserId,
              assignedByUserId: user.id,
              role: targetUser.role,
              department,
            },
          });

      const updateResult = await tx.task.updateMany({
        where: {
          projectId: params.id,
          taskType: { in: deptConfig.taskTypes },
        },
        data: { agentId: agentUserId },
      });

      await tx.projectLog.create({
        data: {
          projectId: params.id,
          action: "team_assigned",
          details: JSON.stringify({
            assignedUser: targetUser.name,
            assignedRole: targetUser.role,
            department,
            assignedBy: user.name,
            taskTypes: deptConfig.taskTypes,
            tasksUpdated: updateResult.count,
          }),
          userId: user.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: agentUserId,
          type: "task_assigned",
          message: `You have been assigned ${department.replace(/_/g, " ")} work by ${user.name}`,
          title: "New Assignment",
          link: deptConfig.dashboardLink,
        },
      });

      return { assignment, tasksUpdated: updateResult.count };
    });

    // Ensure newly-assigned agent receives any unresolved warnings on this project
    await backfillReceiptsForNewMember(params.id, agentUserId);

    try {
      const { pusherServer } = await import("@/lib/pusher");
      if (pusherServer) {
        await pusherServer.trigger(`private-user-${agentUserId}`, "team-distributed", {
          projectId: params.id,
        });
      }
    } catch (pusherError) {
      console.error("Pusher team-distributed error:", pusherError);
    }

    return NextResponse.json({ success: true, assignment: result.assignment, tasksUpdated: result.tasksUpdated });
  } catch (error: any) {
    console.error("Assign agent error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
