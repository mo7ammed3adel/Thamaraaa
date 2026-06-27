import { backfillReceiptsForNewMember, canDistributeTo } from "@/lib/distribution";
import {
  createProjectLog,
  findActiveUserForAssignment,
  findProjectTeamAssignmentScope,
  findProjectStatusAuth,
  replaceProjectTeamAssignment,
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
