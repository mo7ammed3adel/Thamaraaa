import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    
    const user = session.user as any;
    const projectId = params.id;
    
    const body = await req.json();
    const { department, assignedRoleType, newUserId } = body;
    
    if (!department || !assignedRoleType || !newUserId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const targetUser = await prisma.user.findUnique({ where: { id: newUserId }});
    if (!targetUser) return NextResponse.json({ error: "Target user not found" }, { status: 404 });

    // Step 1: Manage TeamAssignments correctly
    // Since @@unique([projectId, userId]) exists, a user can only have ONE assignment per project total.
    
    // First, find and delete any existing active team assignment for THIS exact department AND roleType
    // so we can replace them.
    const oldAssignments = await prisma.teamAssignment.findMany({
      where: {
        projectId,
        department,
        status: "active",
        // 'leader' or 'agent'
        role: { contains: assignedRoleType === "leader" ? "leader" : "agent" }
      }
    });

    for (const oa of oldAssignments) {
        await prisma.teamAssignment.delete({ where: { id: oa.id } });
    }

    // Now securely upsert the NEW user's team assignment. We use upsert because the user might
    // already have a team assignment on this project (which would trigger the unique constraint)
    await prisma.teamAssignment.upsert({
      where: {
        projectId_userId: { projectId, userId: newUserId }
      },
      update: {
        department: department, // Overwrite department if they were moved
        role: targetUser.role,
        status: "active"
      },
      create: {
        projectId,
        userId: newUserId,
        assignedByUserId: user.id,
        role: targetUser.role,
        department,
        status: "active"
      }
    });

    // Step 2: Update all existing tasks for this department to point to the new user
    const taskTypeMapping: Record<string, string[]> = {
      "SEO": ["SEO", "content_seo"],
      "Social Media": ["Social_Media", "social_media"],
      "Media Buyer": ["Media_Buyer", "media_buying"],
      "Graphic Design": ["graphic_design"],
      "Motion Graphic": ["motion_graphic"],
      "UI/UX Design": ["ui_design"],
      "Technical": ["technical"]
    };
    
    // Find matching keys ignoring case
    const matchedDeptKey = Object.keys(taskTypeMapping).find(
        (key) => key.toLowerCase() === department.toLowerCase()
    );
    const typesToUpdate = matchedDeptKey ? taskTypeMapping[matchedDeptKey] : [department];
    
    const updateData = assignedRoleType === "leader" ? { leaderId: newUserId } : { agentId: newUserId };
    
    await prisma.task.updateMany({
      where: { 
          projectId, 
          taskType: { in: typesToUpdate } 
      },
      data: updateData
    });

    // Step 3: Logging and Notifications
    await prisma.projectLog.create({
      data: {
        projectId,
        action: "team_assigned",
        details: JSON.stringify({
          message: `Reassigned ${department} ${assignedRoleType} to ${targetUser.name}`,
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
        userId: newUserId,
        title: "Team Assignment Updated",
        message: `You were assigned as ${assignedRoleType} for ${department} on a project.`,
        type: "project_assigned",
        link: `/dashboard/operations`,
      },
    });

    return NextResponse.json({ success: true, message: "Team assignment updated successfully" });
  } catch (error: any) {
    console.error("Team assignment API Error: ", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
