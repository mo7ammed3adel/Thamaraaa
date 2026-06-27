import {
  backfillReceiptsForNewMember,
  canDistributeTo,
  canFlagTask,
  canReassignTask,
  userCanAccessProject,
} from "@/lib/distribution";
import { getDefaultChecklistForTaskType } from "@/lib/constants";
import {
  ACCOUNT_MANAGER_ROLES,
  AGENT_ASSIGNER_ROLES,
  CROSS_TEAM_TASK_TYPES,
  MANAGEMENT_ROLES,
  hasRole,
} from "@/lib/constants";
import { findTeamLeaderRoleForTaskType } from "@/lib/distribution";
import { normalizeWebUrl } from "@/lib/safe-url";
import { safeTrigger } from "@/lib/pusher";
import {
  createTaskNotification,
  createTaskProjectLog,
  createTaskRecord,
  createSelfAssignedTaskWithLog,
  findActiveTeamAssignmentByRole,
  findFirstActiveUserByRoles,
  findProjectNameForTask,
  findTasksForList,
  findTaskForFlag,
  findTaskForReassign,
  findProjectForSelfTask,
  findUserForTaskAssignment,
  flagTaskWithNotificationAndLog,
  reassignTaskWithNotificationsAndLog,
} from "@/server/repositories/taskRepository";

const TASK_AGENT_ROLE_MAP: Record<string, string[]> = {
  SEO: ["agent_seo"],
  seo: ["agent_seo"],
  content_seo: ["agent_content_seo"],
  Social_Media: ["agent_social_media"],
  social_media: ["agent_social_media"],
  Media_Buyer: ["agent_media_buyer"],
  media_buyer: ["agent_media_buyer"],
  media_buying: ["agent_media_buyer"],
  graphic_design: ["agent_graphic_designer"],
  motion_graphic: ["agent_motion_graphic"],
  ui_design: ["agent_ui"],
};

const AGENT_DEPARTMENT_MAP: Record<string, string> = {
  agent_seo: "seo",
  agent_content_seo: "content_seo",
  agent_social_media: "social_media",
  agent_media_buyer: "media_buyer",
  agent_graphic_designer: "graphic_design",
  agent_motion_graphic: "motion_graphic",
  agent_ui: "ui_design",
};

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

const TASK_CREATOR_ROLES = [
  ...AGENT_ASSIGNER_ROLES,
  ...MANAGEMENT_ROLES,
  ...ACCOUNT_MANAGER_ROLES,
  "agent_social_media",
  "agent_media_buyer",
  "agent_seo",
  "agent_content_seo",
] as const;

export async function listTasksForUser(input: {
  userId: string;
  userRole: string;
  projectId?: string | null;
}) {
  const whereClause: any = {};

  if (input.projectId) {
    const allowed = await userCanAccessProject(input.userId, input.userRole, input.projectId);
    if (!allowed) return { status: "forbidden" as const };
    whereClause.projectId = input.projectId;
  } else if (["super_admin", "head_account_manager", "chief_sales"].includes(input.userRole)) {
    // org-wide visibility
  } else if (input.userRole === "account_manager") {
    whereClause.project = { is: { accountManagerId: input.userId } };
  } else if (input.userRole === "head_technical") {
    whereClause.project = { is: { headTechnicalId: input.userId } };
  } else if (input.userRole === "head_seo") {
    whereClause.project = { is: { headSeoId: input.userId } };
  } else {
    whereClause.OR = [
      { leaderId: input.userId },
      { agentId: input.userId },
      { project: { is: { teamAssignments: { some: { userId: input.userId, status: "active" } } } } },
    ];
  }

  const tasks = await findTasksForList(whereClause);
  return { status: "ok" as const, tasks };
}

export async function flagTask(input: {
  taskId: string;
  userId: string;
  userName?: string | null;
  userRole: string;
  body: any;
}) {
  const task = await findTaskForFlag(input.taskId);
  if (!task) return { status: "not_found" as const };

  if (!canFlagTask(input.userRole, task.agentId, input.userId)) {
    return { status: "forbidden" as const };
  }

  const reason = typeof input.body.reason === "string" ? input.body.reason.trim() : "";
  if (!reason) return { status: "missing_reason" as const };

  const updatedTask = await flagTaskWithNotificationAndLog({
    taskId: input.taskId,
    projectId: task.projectId,
    leaderId: task.leaderId,
    taskType: task.taskType,
    reason,
    userId: input.userId,
    userName: input.userName || input.userId,
  });

  return { status: "ok" as const, task: updatedTask };
}

export async function reassignTask(input: {
  taskId: string;
  userId: string;
  userName?: string | null;
  userRole: string;
  body: any;
}) {
  if (!canReassignTask(input.userRole)) {
    return { status: "not_team_leader" as const };
  }

  const task = await findTaskForReassign(input.taskId);
  if (!task) return { status: "not_found" as const };

  if (input.userRole !== "super_admin" && task.leaderId !== input.userId) {
    return { status: "not_task_leader" as const };
  }

  const newAgentId = typeof input.body.newAgentId === "string" ? input.body.newAgentId.trim() : "";
  if (!newAgentId) return { status: "missing_new_agent" as const };

  const newAgent = await findUserForTaskAssignment(newAgentId);
  if (!newAgent || newAgent.status !== "Active") {
    return { status: "agent_not_found" as const };
  }

  if (!canDistributeTo(input.userRole, newAgent.role)) {
    return { status: "cannot_reassign_to_role" as const, role: newAgent.role };
  }

  const allowedAgentRoles = TASK_AGENT_ROLE_MAP[task.taskType] || [];
  if (!allowedAgentRoles.includes(newAgent.role)) {
    return { status: "cannot_receive_task_type" as const, role: newAgent.role, taskType: task.taskType };
  }

  const updatedTask = await reassignTaskWithNotificationsAndLog({
    taskId: input.taskId,
    projectId: task.projectId,
    taskType: task.taskType,
    taskStatus: task.status,
    leaderId: task.leaderId,
    newAgentId,
    newAgentName: newAgent.name,
    newAgentRole: newAgent.role,
    previousAgentId: task.agentId,
    agentDepartment: AGENT_DEPARTMENT_MAP[newAgent.role],
    userId: input.userId,
    userName: input.userName || input.userId,
  });

  await backfillReceiptsForNewMember(task.projectId, newAgentId);

  return { status: "ok" as const, task: updatedTask };
}

export async function createSelfTask(input: {
  userId: string;
  userName?: string | null;
  userRole: string;
  body: any;
}) {
  if (!SELF_TASK_ALLOWED_ROLES.includes(input.userRole)) {
    return { status: "role_forbidden" as const };
  }

  const { projectId, brief, priority, deadline, taskType } = input.body;

  if (!projectId || !brief?.trim()) {
    return { status: "missing_project_or_brief" as const };
  }

  if (!taskType) {
    return { status: "missing_task_type" as const };
  }

  const project = await findProjectForSelfTask(projectId, input.userId);
  if (!project) return { status: "project_not_found" as const };

  const hasAccess =
    input.userRole === "super_admin" ||
    project.teamAssignments.length > 0 ||
    project.tasks.length > 0;

  if (!hasAccess) {
    return { status: "project_forbidden" as const };
  }

  const trimmedBrief = brief.trim();
  const task = await createSelfAssignedTaskWithLog({
    projectId,
    userId: input.userId,
    userName: input.userName || input.userId,
    userRole: input.userRole,
    taskType,
    brief: trimmedBrief,
    priority,
    deadline,
    checklistItems: getDefaultChecklistForTaskType(taskType),
    projectName: project.deal?.lead?.name || "Unknown Project",
  });

  return { status: "ok" as const, task };
}

async function resolveTaskLeader(projectId: string, roleToFind: string) {
  if (["team_leader_seo"].includes(roleToFind)) {
    return findFirstActiveUserByRoles(["head_seo", "team_leader_seo"]);
  }

  return findFirstActiveUserByRoles([roleToFind, "super_admin"]);
}

export async function createProjectTask(input: {
  userId: string;
  userRole: string;
  userName?: string | null;
  body: any;
}) {
  if (!hasRole(input.userRole, TASK_CREATOR_ROLES)) {
    return { status: "role_forbidden" as const };
  }

  const {
    projectId,
    leaderId,
    assignedRole,
    taskType,
    priority,
    brief,
    taskLink,
    deadline,
    checklistItems,
  } = input.body;

  if (!projectId || !taskType) {
    return { status: "missing_project_or_task_type" as const };
  }

  const safeTaskLink = taskLink ? normalizeWebUrl(taskLink) : null;
  if (taskLink && !safeTaskLink) {
    return { status: "invalid_task_link" as const };
  }

  const projectAllowed = await userCanAccessProject(input.userId, input.userRole, projectId);
  if (!projectAllowed) {
    return { status: "project_forbidden" as const };
  }

  let finalLeaderId = leaderId;
  let finalAssignedRole = assignedRole;

  const isCrossTeam = CROSS_TEAM_TASK_TYPES.includes(taskType);

  if (isCrossTeam && !finalLeaderId) {
    const leaderRole = findTeamLeaderRoleForTaskType(taskType);
    if (leaderRole) {
      const projectLeader = await findActiveTeamAssignmentByRole(projectId, leaderRole);
      if (projectLeader) {
        finalLeaderId = projectLeader.userId;
        finalAssignedRole = leaderRole;
      } else {
        const leader = await findFirstActiveUserByRoles([leaderRole]);
        if (leader) {
          finalLeaderId = leader.id;
          finalAssignedRole = leaderRole;
        }
      }
    }

    if (!finalLeaderId) {
      const admin = await findFirstActiveUserByRoles(["super_admin"]);
      if (admin) {
        finalLeaderId = admin.id;
        finalAssignedRole = "super_admin";
      }
    }
  } else if (!finalLeaderId) {
    let roleToFind = "super_admin";
    switch (taskType) {
      case "seo":
      case "content_seo":
        roleToFind = "head_seo";
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

    const leader = await resolveTaskLeader(projectId, roleToFind);
    if (leader) finalLeaderId = leader.id;
  }

  if (!projectId || !finalLeaderId || !taskType) {
    return { status: "leader_not_found" as const, taskType };
  }

  const project = await findProjectNameForTask(projectId);
  const projectName = project?.deal?.lead?.name || "Unknown Project";

  const task = await createTaskRecord({
    projectId,
    leaderId: finalLeaderId,
    assignedRole: finalAssignedRole || null,
    taskType,
    brief: brief || "",
    taskLink: safeTaskLink,
    priority: priority || "Medium",
    deadline: deadline ? new Date(deadline) : null,
    checklistItems: checklistItems || getDefaultChecklistForTaskType(taskType),
    requesterRole: input.userRole,
    status: "pending",
    progressPct: 0,
  });

  if (isCrossTeam) {
    await createTaskProjectLog({
      projectId,
      action: "task_created",
      details: JSON.stringify({
        description: `Cross-team task created: ${taskType.replace(/_/g, " ")} for ${projectName}`,
        taskType,
        priority: priority || "Medium",
      }),
      userId: input.userId,
    });

    await createTaskNotification({
      userId: finalLeaderId,
      type: "task_assigned",
      title: "Cross-Team Task Request",
      message: `A new ${taskType.replace(/_/g, " ")} task has been requested by ${input.userName} for ${projectName}`,
      link: "/dashboard/operations",
    });

    await safeTrigger(`private-user-${finalLeaderId}`, "task-assigned", {
      projectId,
      taskId: task.id,
    });
    await safeTrigger(`private-project-${projectId}`, "task-status-changed", {
      taskId: task.id,
      status: "pending",
    });
  }

  return { status: "ok" as const, task };
}
