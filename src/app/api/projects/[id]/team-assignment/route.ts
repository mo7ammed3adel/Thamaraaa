import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backfillReceiptsForNewMember } from "@/lib/distribution";

/**
 * Department display name to internal keys mapping.
 * Maps UI department names to the database department codes and task types.
 */
const DEPT_CONFIG: Record<string, { dbDepartments: string[]; taskTypes: string[]; leaderRoles: string[]; agentRoles: string[] }> = {
  "SEO":             { dbDepartments: ["seo", "content_seo"],    taskTypes: ["SEO", "seo", "content_seo"], leaderRoles: ["team_leader_seo"], agentRoles: ["agent_seo", "agent_content_seo"] },
  "Social Media":    { dbDepartments: ["social_media"],          taskTypes: ["Social_Media", "social_media"], leaderRoles: ["team_leader_social_media"], agentRoles: ["agent_social_media"] },
  "Media Buyer":     { dbDepartments: ["media_buyer"],           taskTypes: ["Media_Buyer", "media_buyer", "media_buying"], leaderRoles: ["team_leader_media_buyer"], agentRoles: ["agent_media_buyer"] },
  "Graphic Design":  { dbDepartments: ["graphic_design"],        taskTypes: ["graphic_design"], leaderRoles: ["leader_graphic_designer"], agentRoles: ["agent_graphic_designer"] },
  "Motion Graphics": { dbDepartments: ["motion_graphic"],        taskTypes: ["motion_graphic"], leaderRoles: ["leader_motion_graphic"], agentRoles: ["agent_motion_graphic"] },
  "UI/UX Design":    { dbDepartments: ["ui_design"],             taskTypes: ["ui_design"], leaderRoles: ["leader_ui"], agentRoles: ["agent_ui"] },
  "Technical":       { dbDepartments: ["technical"],             taskTypes: ["technical"], leaderRoles: ["head_technical"], agentRoles: [] },
};

function canAssignDepartment(userRole: string, department: string, assignedRoleType: string) {
  if (["super_admin", "head_account_manager"].includes(userRole)) return true;
  if (userRole === "head_technical") {
    return assignedRoleType === "leader" && ["Social Media", "Media Buyer"].includes(department);
  }
  if (userRole === "head_seo") {
    return assignedRoleType === "leader" && department === "SEO";
  }
  return false;
}

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

    if (!["leader", "agent"].includes(assignedRoleType)) {
      return NextResponse.json({ error: "assignedRoleType must be leader or agent" }, { status: 400 });
    }

    // Validate department
    const deptConfig = DEPT_CONFIG[department];
    if (!deptConfig) {
      return NextResponse.json({ error: `Unknown department: ${department}` }, { status: 400 });
    }

    if (!canAssignDepartment(user.role, department, assignedRoleType)) {
      return NextResponse.json({ error: `Your role cannot assign ${assignedRoleType}s for ${department}` }, { status: 403 });
    }

    // Validate target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: newUserId } });
    if (!targetUser || targetUser.status !== "Active") {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const expectedRoles = assignedRoleType === "leader" ? deptConfig.leaderRoles : deptConfig.agentRoles;
    if (!expectedRoles.includes(targetUser.role)) {
      return NextResponse.json({ error: `${targetUser.role} cannot be assigned as ${assignedRoleType} for ${department}` }, { status: 400 });
    }

    // Validate project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (user.role === "head_technical" && project.headTechnicalId !== user.id) {
      return NextResponse.json({ error: "Forbidden: project is not assigned to this Head Technical" }, { status: 403 });
    }

    if (user.role === "head_seo" && project.headSeoId !== user.id) {
      return NextResponse.json({ error: "Forbidden: project is not assigned to this Head SEO" }, { status: 403 });
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

    // Newly-added member should also be subject to existing unresolved warnings
    await backfillReceiptsForNewMember(projectId, newUserId);

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
