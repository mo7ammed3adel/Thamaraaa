import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDistributeTo } from "@/lib/distribution";

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

    // Check project exists
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const existingAssignment = await prisma.teamAssignment.findUnique({
      where: { projectId_userId: { projectId: params.id, userId: agentUserId } },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: `${targetUser.name} is already assigned to this project` },
        { status: 409 }
      );
    }

    const assignment = await prisma.teamAssignment.create({
      data: {
        projectId: params.id,
        userId: agentUserId,
        assignedByUserId: user.id,
        role: targetUser.role,
        department,
      },
    });

    // Determine the task types for the given department
    let taskTypes: string[] = [];
    if (department === "seo" || department === "content_seo") taskTypes = ["SEO", "seo", "content_seo"];
    else if (department === "social_media") taskTypes = ["Social_Media", "social_media"];
    else if (department === "media_buyer") taskTypes = ["Media_Buyer", "media_buyer", "media_buying"];
    else if (department === "graphic_design") taskTypes = ["graphic_design"];
    else if (department === "motion_graphic") taskTypes = ["motion_graphic"];
    else if (department === "ui_design") taskTypes = ["ui_design"];

    // Assign existing tasks to this agent
    await prisma.task.updateMany({
      where: {
        projectId: params.id,
        taskType: { in: taskTypes },
      },
      data: { agentId: agentUserId },
    });

    await prisma.projectLog.create({
      data: {
        projectId: params.id,
        action: "team_assigned",
        details: JSON.stringify({
          assignedUser: targetUser.name,
          assignedRole: targetUser.role,
          department,
          assignedBy: user.name,
        }),
        userId: user.id,
      },
    });

    await prisma.notification.create({
      data: {
        userId: agentUserId,
        type: "task_assigned",
        message: `You have been assigned to a project by ${user.name}`,
        title: "New Assignment",
        link: "/dashboard/operations",
      },
    });

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

    return NextResponse.json({ success: true, assignment });
  } catch (error: any) {
    console.error("Assign agent error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
