import { backfillReceiptsForNewMember, canDistributeTo } from "@/lib/distribution";
import { safeTrigger } from "@/lib/pusher";
import {
  assignDepartmentAgent,
  createDistributionTeamAssignmentWithLog,
  createProjectAssignmentNotification,
  createProjectLog,
  findActiveUserForAssignment,
  findProjectAgentAssignmentScope,
  findProjectTeamAssignmentScope,
  findProjectStatusAuth,
  findProjectTeamAssignment,
  replaceProjectTeamAssignment,
  updateProjectDistributionWithLog,
  updateProjectFields,
} from "@/server/repositories/projectRepository";

const DEPT_CONFIG: Record<
  string,
  { dbDepartments: string[]; taskTypes: string[]; leaderRoles: string[]; agentRoles: string[] }
> = {
  SEO: {
    dbDepartments: ["seo", "content_seo"],
    taskTypes: ["SEO", "seo", "content_seo"],
    leaderRoles: ["team_leader_seo"],
    agentRoles: ["agent_seo", "agent_content_seo"],
  },
  "Social Media": {
    dbDepartments: ["social_media"],
    taskTypes: ["Social_Media", "social_media"],
    leaderRoles: ["team_leader_social_media"],
    agentRoles: ["agent_social_media"],
  },
  "Media Buyer": {
    dbDepartments: ["media_buyer"],
    taskTypes: ["Media_Buyer", "media_buyer", "media_buying"],
    leaderRoles: ["team_leader_media_buyer"],
    agentRoles: ["agent_media_buyer"],
  },
  "Graphic Design": {
    dbDepartments: ["graphic_design"],
    taskTypes: ["graphic_design"],
    leaderRoles: ["leader_graphic_designer"],
    agentRoles: ["agent_graphic_designer"],
  },
  "Motion Graphics": {
    dbDepartments: ["motion_graphic"],
    taskTypes: ["motion_graphic"],
    leaderRoles: ["leader_motion_graphic"],
    agentRoles: ["agent_motion_graphic"],
  },
  "UI/UX Design": {
    dbDepartments: ["ui_design"],
    taskTypes: ["ui_design"],
    leaderRoles: ["leader_ui"],
    agentRoles: ["agent_ui"],
  },
  Technical: {
    dbDepartments: ["technical"],
    taskTypes: ["technical"],
    leaderRoles: ["head_technical"],
    agentRoles: [],
  },
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

const DEPARTMENT_AGENT_CONFIG: Record<
  string,
  { taskTypes: string[]; agentRoles: string[]; dashboardLink: string }
> = {
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

const ROLE_TO_DEPARTMENT: Record<string, string> = {
  team_leader_social_media: "social_media",
  agent_social_media: "social_media",
  team_leader_media_buyer: "media_buyer",
  agent_media_buyer: "media_buyer",
  team_leader_seo: "seo",
  agent_seo: "seo",
  agent_content_seo: "content_seo",
  leader_graphic_designer: "graphic_design",
  agent_graphic_designer: "graphic_design",
  leader_motion_graphic: "motion_graphic",
  agent_motion_graphic: "motion_graphic",
  leader_ui: "ui_design",
  agent_ui: "ui_design",
};

export async function assignProjectRole(input: {
  projectId: string;
  userId: string;
  userRole: string;
  body: any;
}) {
  const { targetRole, assigneeId } = input.body;

  if (!targetRole || !assigneeId) {
    return { status: "missing_fields" as const };
  }

  if (!canDistributeTo(input.userRole, targetRole)) {
    return { status: "cannot_assign" as const, targetRole };
  }

  const assignee = await findActiveUserForAssignment(assigneeId);
  if (!assignee || assignee.status !== "Active" || assignee.role !== targetRole) {
    return { status: "invalid_assignee" as const };
  }

  const project = await findProjectStatusAuth(input.projectId);
  if (!project) return { status: "project_not_found" as const };

  if (input.userRole === "account_manager" && project.accountManagerId !== input.userId) {
    return { status: "own_account_manager_forbidden" as const };
  }
  if (input.userRole === "head_technical" && project.headTechnicalId !== input.userId) {
    return { status: "own_head_technical_forbidden" as const };
  }
  if (input.userRole === "head_seo" && project.headSeoId !== input.userId) {
    return { status: "own_head_seo_forbidden" as const };
  }

  const updateData: {
    accountManagerId?: string;
    headTechnicalId?: string;
    headSeoId?: string;
    projectStatus?: string;
    assignedAt?: Date;
  } = {};

  if (targetRole === "account_manager") {
    updateData.accountManagerId = assigneeId;
    updateData.projectStatus = "assigned";
    updateData.assignedAt = new Date();
  } else if (targetRole === "head_technical") {
    updateData.headTechnicalId = assigneeId;
  } else if (targetRole === "head_seo") {
    updateData.headSeoId = assigneeId;
  } else {
    return { status: "unsupported_role" as const };
  }

  const updatedProject = await updateProjectFields(input.projectId, updateData);

  await backfillReceiptsForNewMember(input.projectId, assigneeId);

  await createProjectLog({
    projectId: updatedProject.id,
    action: "assigned",
    details: `${targetRole.replace(/_/g, " ").toUpperCase()} assigned to ${assigneeId}`,
    userId: input.userId,
  });

  return { status: "ok" as const, project: updatedProject };
}

export async function assignProjectTeamSlot(input: {
  projectId: string;
  userId: string;
  userRole: string;
  userName?: string | null;
  body: any;
}) {
  if (!["super_admin", "head_account_manager", "head_technical", "head_seo"].includes(input.userRole)) {
    return { status: "insufficient_role" as const };
  }

  const { department, assignedRoleType, newUserId } = input.body;

  if (!department || !assignedRoleType || !newUserId) {
    return { status: "missing_fields" as const };
  }

  if (!["leader", "agent"].includes(assignedRoleType)) {
    return { status: "invalid_role_type" as const };
  }

  const deptConfig = DEPT_CONFIG[department];
  if (!deptConfig) {
    return { status: "unknown_department" as const, department };
  }

  if (!canAssignDepartment(input.userRole, department, assignedRoleType)) {
    return { status: "department_forbidden" as const, department, assignedRoleType };
  }

  const targetUser = await findActiveUserForAssignment(newUserId);
  if (!targetUser || targetUser.status !== "Active") {
    return { status: "target_not_found" as const };
  }

  const expectedRoles = assignedRoleType === "leader" ? deptConfig.leaderRoles : deptConfig.agentRoles;
  if (!expectedRoles.includes(targetUser.role)) {
    return {
      status: "target_role_invalid" as const,
      targetRole: targetUser.role,
      assignedRoleType,
      department,
    };
  }

  const project = await findProjectTeamAssignmentScope(input.projectId);
  if (!project) return { status: "project_not_found" as const };

  if (input.userRole === "head_technical" && project.headTechnicalId !== input.userId) {
    return { status: "head_technical_forbidden" as const };
  }

  if (input.userRole === "head_seo" && project.headSeoId !== input.userId) {
    return { status: "head_seo_forbidden" as const };
  }

  const result = await replaceProjectTeamAssignment({
    projectId: input.projectId,
    userId: input.userId,
    userName: input.userName || input.userId,
    targetUserId: newUserId,
    targetUserName: targetUser.name,
    targetUserRole: targetUser.role,
    department,
    assignedRoleType,
    dbDepartments: deptConfig.dbDepartments,
    taskTypes: deptConfig.taskTypes,
    canonicalDepartment: deptConfig.dbDepartments[0],
  });

  await backfillReceiptsForNewMember(input.projectId, newUserId);

  return {
    status: "ok" as const,
    targetUserName: targetUser.name,
    assignedRoleType,
    department,
    tasksUpdated: result.tasksUpdated,
  };
}

export async function assignProjectAgent(input: {
  projectId: string;
  userId: string;
  userRole: string;
  userName?: string | null;
  body: any;
}) {
  const allowedRoles = [
    "team_leader_social_media",
    "team_leader_media_buyer",
    "team_leader_seo",
    "leader_graphic_designer",
    "leader_motion_graphic",
    "leader_ui",
    "super_admin",
  ];
  if (!allowedRoles.includes(input.userRole)) {
    return { status: "role_not_allowed" as const };
  }

  const { agentUserId, department } = input.body;
  if (!agentUserId || !department) {
    return { status: "missing_fields" as const };
  }

  const deptConfig = DEPARTMENT_AGENT_CONFIG[department];
  if (!deptConfig) {
    return { status: "unknown_department" as const, department };
  }

  const targetUser = await findActiveUserForAssignment(agentUserId);
  if (!targetUser || targetUser.status !== "Active") {
    return { status: "target_not_found" as const };
  }

  if (!canDistributeTo(input.userRole, targetUser.role)) {
    return { status: "cannot_distribute" as const, targetRole: targetUser.role };
  }

  if (!deptConfig.agentRoles.includes(targetUser.role)) {
    return { status: "cannot_receive_department" as const, targetRole: targetUser.role, department };
  }

  const project = await findProjectAgentAssignmentScope(input.projectId, input.userId);
  if (!project) return { status: "project_not_found" as const };

  const canManageThisProject =
    input.userRole === "super_admin" ||
    project.headTechnicalId === input.userId ||
    project.headSeoId === input.userId ||
    project.teamAssignments.length > 0 ||
    project.tasks.length > 0;

  if (!canManageThisProject) {
    return { status: "project_manage_forbidden" as const };
  }

  const result = await assignDepartmentAgent({
    projectId: input.projectId,
    userId: input.userId,
    userName: input.userName || input.userId,
    agentUserId,
    agentUserName: targetUser.name,
    agentRole: targetUser.role,
    department,
    taskTypes: deptConfig.taskTypes,
    agentRoles: deptConfig.agentRoles,
    dashboardLink: deptConfig.dashboardLink,
  });

  await backfillReceiptsForNewMember(input.projectId, agentUserId);

  await safeTrigger(`private-user-${agentUserId}`, "team-distributed", {
    projectId: input.projectId,
  });

  return { status: "ok" as const, assignment: result.assignment, tasksUpdated: result.tasksUpdated };
}

export async function distributeProject(input: {
  projectId?: string;
  targetUserId?: string;
  userId: string;
  userRole: string;
  userName?: string | null;
  taskGenerationUrl: string;
  cookie: string;
}) {
  if (!input.projectId || !input.targetUserId) {
    return { status: "missing_fields" as const };
  }

  const targetUser = await findActiveUserForAssignment(input.targetUserId);
  if (!targetUser || targetUser.status !== "Active") {
    return { status: "target_not_found" as const };
  }

  if (!canDistributeTo(input.userRole, targetUser.role)) {
    return { status: "cannot_distribute" as const, targetRole: targetUser.role };
  }

  const project = await findProjectStatusAuth(input.projectId);
  if (!project) return { status: "project_not_found" as const };

  if (input.userRole === "account_manager" && project.accountManagerId !== input.userId) {
    return { status: "own_account_manager_forbidden" as const };
  }
  if (input.userRole === "head_technical" && project.headTechnicalId !== input.userId) {
    return { status: "own_head_technical_forbidden" as const };
  }
  if (input.userRole === "head_seo" && project.headSeoId !== input.userId) {
    return { status: "own_head_seo_forbidden" as const };
  }

  const userName = input.userName || input.userId;

  const updateData: Record<string, unknown> = {};
  let assignmentDescription = "";

  if (targetUser.role === "account_manager") {
    updateData.accountManagerId = targetUser.id;
    assignmentDescription = `Account Manager assigned: ${targetUser.name}`;
  } else if (targetUser.role === "head_technical") {
    updateData.headTechnicalId = targetUser.id;
    assignmentDescription = `Head Technical assigned: ${targetUser.name}`;
  } else if (targetUser.role === "head_seo") {
    updateData.headSeoId = targetUser.id;
    assignmentDescription = `Head SEO assigned: ${targetUser.name}`;
  } else {
    const existingAssignment = await findProjectTeamAssignment(input.projectId, targetUser.id);
    if (existingAssignment) {
      return { status: "duplicate_assignment" as const, targetUserName: targetUser.name };
    }

    const department = ROLE_TO_DEPARTMENT[targetUser.role] || "general";

    await createDistributionTeamAssignmentWithLog({
      projectId: input.projectId,
      userId: input.userId,
      userName,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      targetUserRole: targetUser.role,
      department,
    });

    await backfillReceiptsForNewMember(input.projectId, targetUser.id);

    if (targetUser.role.includes("leader") || targetUser.role.includes("head")) {
      try {
        await fetch(input.taskGenerationUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: input.cookie,
          },
          body: JSON.stringify({
            projectId: input.projectId,
            packageType:
              department === "social_media" || department === "media_buyer" ? department : "general",
            socialLeaderId: department === "social_media" ? targetUser.id : undefined,
            mediaLeaderId: department === "media_buyer" ? targetUser.id : undefined,
            seoLeaderId: department === "seo" ? targetUser.id : undefined,
          }),
        });
      } catch (e) {
        console.error("Auto task generation failed:", e);
      }
    }

    await safeTrigger("projects-channel", "team-assigned", {
      projectId: input.projectId,
      userId: targetUser.id,
      role: targetUser.role,
      assignedBy: userName,
    });

    await createProjectAssignmentNotification({
      userId: targetUser.id,
      title: "New Project Assignment",
      message: `You have been assigned to a project by ${userName}`,
      type: "project_assigned",
      link: `/dashboard/operations`,
    });

    return {
      status: "team_assigned" as const,
      assignment: { projectId: input.projectId, userId: targetUser.id, department },
    };
  }

  if (Object.keys(updateData).length > 0) {
    updateData.assignedAt = new Date();

    await updateProjectDistributionWithLog({
      projectId: input.projectId,
      updateData,
      assignmentDescription,
      userId: input.userId,
      userName,
      userRole: input.userRole,
    });

    await backfillReceiptsForNewMember(input.projectId, targetUser.id);

    await createProjectAssignmentNotification({
      userId: targetUser.id,
      title: "New Project Assigned",
      message: `${assignmentDescription} by ${userName}`,
      type: "project_assigned",
      link: `/dashboard/operations`,
    });

    await safeTrigger("projects-channel", "project-distributed", {
      projectId: input.projectId,
      assignedTo: targetUser.name,
      assignedToRole: targetUser.role,
      assignedBy: userName,
    });

    return { status: "project_assigned" as const, project: { id: input.projectId, ...updateData } };
  }

  return { status: "no_distribution_rule" as const };
}
