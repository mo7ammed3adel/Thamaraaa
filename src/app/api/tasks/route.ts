import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, leaderId, assignedRole, taskType, priority, brief, deadline, checklistItems } = body;

    const user = session.user as any;

    let finalLeaderId = leaderId;

    if (!finalLeaderId) {
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
        case "graphic_design":
          roleToFind = "leader_graphic_designer";
          break;
        case "motion_graphic":
          roleToFind = "leader_motion_graphic";
          break;
        case "ui_design":
          roleToFind = "leader_ui";
          break;
        case "technical":
          roleToFind = "head_technical";
          break;
      }
      
      const leader = await prisma.user.findFirst({ where: { role: { in: [roleToFind, "team_leader_seo"].includes(roleToFind) ? ["head_seo", "team_leader_seo"] : [roleToFind, "super_admin"] }, status: "Active" } });
      if (leader) finalLeaderId = leader.id;
    }

    if (!projectId || !finalLeaderId || !taskType) {
      return NextResponse.json({ error: "Missing required fields or cannot find a leader for this task type" }, { status: 400 });
    }

    const newTask = await prisma.task.create({
      data: {
        projectId,
        leaderId: finalLeaderId,
        assignedRole: assignedRole || null,
        taskType,
        brief: brief || "",
        priority: priority || "Medium",
        deadline: deadline ? new Date(deadline) : null,
        checklistItems: checklistItems || "[]",
        requesterRole: user.role,
        status: "pending",
        progressPct: 0
      }
    });

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
