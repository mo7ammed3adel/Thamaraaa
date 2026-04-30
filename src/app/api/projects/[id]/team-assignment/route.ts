import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Department display name to internal keys mapping.
 * Maps UI department names to the database department codes and task types.
 */
const DEPT_CONFIG: Record<string, { dbDepartments: string[]; taskTypes: string[] }> = {
  "SEO":             { dbDepartments: ["seo", "content_seo"],    taskTypes: ["SEO", "seo", "content_seo"] },
  "Social Media":    { dbDepartments: ["social_media"],          taskTypes: ["Social_Media", "social_media"] },
  "Media Buyer":     { dbDepartments: ["media_buyer"],           taskTypes: ["Media_Buyer", "media_buyer", "media_buying"] },
  "Graphic Design":  { dbDepartments: ["graphic_design"],        taskTypes: ["graphic_design"] },
  "Motion Graphics": { dbDepartments: ["motion_graphic"],        taskTypes: ["motion_graphic"] },
  "UI/UX Design":    { dbDepartments: ["ui_design"],             taskTypes: ["ui_design"] },
  "Technical":       { dbDepartments: ["technical"],             taskTypes: ["technical"] },
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const user = session.user as any;
    const projectId = params.id;

    // Only admins and head roles can perform team assignments
    const allowedRoles = ["super_admin", "head_account_manager", "head_technical", "head_seo"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
    }

    const body = await req.json();
    const { department, assignedRoleType, newUserId } = body;

    if (!department || !assignedRoleType || !newUserId) {
      return NextResponse.json({ error: "Missing required fields: department, assignedRoleType, newUserId" }, { status: 400 });
    }

    // Validate department
    const deptConfig = DEPT_CONFIG[department];
    if (!deptConfig) {
      return NextResponse.json({ error: `Unknown department: ${department}` }, { status: 400 });
    }

    // Validate target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: newUserId } });
    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    // Validate project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // ── Step 1: Clean up old team assignments for this slot ──
    // Find existing assignments in this department that match the roleType (leader vs agent)
    const roleContains = assignedRoleType === "leader" ? "leader" : "agent";
    const oldAssignments = await prisma.teamAssignment.findMany({
      where: {
        projectId,
        department: { in: deptConfig.dbDepartments },
        status: "active",
        role: { contains: roleContains },
      },
    });

    // Remove old assignments (so the new one can take their place)
    if (oldAssignments.length > 0) {
      await prisma.teamAssignment.deleteMany({
        where: { id: { in: oldAssignments.map((a) => a.id) } },
      });
    }

    // ── Step 2: Create new team assignment ──
    // Use the first dbDepartment as the canonical department code
    const canonicalDept = deptConfig.dbDepartments[0];

    // Check if this user already has a different assignment on this project
    const existingUserAssignment = await prisma.teamAssignment.findUnique({
      where: { projectId_userId: { projectId, userId: newUserId } },
    });

    if (existingUserAssignment) {
      // Update their existing assignment to the new department
      await prisma.teamAssignment.update({
        where: { id: existingUserAssignment.id },
        data: {
          department: canonicalDept,
          role: targetUser.role,
          status: "active",
          assignedByUserId: user.id,
        },
      });
    } else {
      await prisma.teamAssignment.create({
        data: {
          projectId,
          userId: newUserId,
          assignedByUserId: user.id,
          role: targetUser.role,
          department: canonicalDept,
          status: "active",
        },
      });
    }

    // ── Step 3: Update all tasks for this department ──
    const updateField = assignedRoleType === "leader" ? { leaderId: newUserId } : { agentId: newUserId };

    const updateResult = await prisma.task.updateMany({
      where: {
        projectId,
        taskType: { in: deptConfig.taskTypes },
      },
      data: updateField,
    });

    // ── Step 4: Audit log ──
    await prisma.projectLog.create({
      data: {
        projectId,
        action: "team_assigned",
        details: JSON.stringify({
          message: `Assigned ${targetUser.name} as ${assignedRoleType} for ${department}`,
          assignedUser: targetUser.name,
          assignedUserRole: targetUser.role,
          department,
          assignedBy: user.name,
          tasksUpdated: updateResult.count,
        }),
        userId: user.id,
      },
    });

    // ── Step 5: Notify the assigned user ──
    await prisma.notification.create({
      data: {
        userId: newUserId,
        title: "Team Assignment",
        message: `You were assigned as ${assignedRoleType} for ${department} by ${user.name}.`,
        type: "project_assigned",
        link: `/dashboard/operations`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${targetUser.name} assigned as ${assignedRoleType} for ${department}`,
      tasksUpdated: updateResult.count,
    });
  } catch (error: any) {
    console.error("Team assignment API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
