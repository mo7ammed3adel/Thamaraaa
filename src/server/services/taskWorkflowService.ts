import {
  backfillReceiptsForNewMember,
  canDistributeTo,
  canFlagTask,
  canReassignTask,
  checkProjectBlockers,
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
import { computeDepartmentProgress } from "@/lib/progress";
import { normalizeDeliverableFiles } from "@/server/parsers/task";
import {
  createTaskNotification,
  createTaskNotifications,
  createTaskProjectLog,
  createTaskRecord,
  createGeneratedTasks,
  createSelfAssignedTaskWithLog,
  createSubTaskWithNotification,
  findAgentForTaskUpdate,
  findActiveTeamAssignmentByRole,
  findExistingTaskTypes,
  findFirstActiveUserByRoles,
  findPackageByName,
  findParentTaskForSubTask,
  findProjectForTaskGeneration,
  findProjectNameForTask,
  findProjectTasksForProgress,
  findTasksForList,
  findTaskForFlag,
  findTaskForReassign,
  findTaskForUpdate,
  findProjectForSelfTask,
  findUserForTaskAssignment,
  flagTaskWithNotificationAndLog,
  reassignTaskWithNotificationsAndLog,
  updateProjectProgress,
  updateProjectStatus,
  updateTaskWithProject,
  upsertTaskAgentAssignment,
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

const STANDARD_GENERATOR_ROLES = new Set([
  "super_admin",
  "head_account_manager",
  "account_manager",
  "head_technical",
  "head_seo",
]);

const SUB_TASK_TYPES: Record<string, { leaderKeys: string[]; leaderRoles: string[]; label: string }> = {
  graphic_design: {
    leaderKeys: ["graphicLeaderId"],
    leaderRoles: ["leader_graphic_designer"],
    label: "Graphic Design",
  },
  motion_graphic: {
    leaderKeys: ["motionLeaderId"],
    leaderRoles: ["leader_motion_graphic"],
    label: "Motion Graphic",
  },
  ui_design: {
    leaderKeys: ["uiLeaderId"],
    leaderRoles: ["leader_ui"],
    label: "UI/UX",
  },
  content_seo: {
    leaderKeys: ["seoLeaderId"],
    leaderRoles: ["team_leader_seo"],
    label: "Content SEO",
  },
};

const SERVICE_CONFIG = {
  seo: {
    services: ["seo"],
    taskTypes: ["SEO", "seo"],
    assignedRole: "seo",
    bodyKeys: ["seoLeaderId"],
    leaderRoles: ["team_leader_seo", "head_seo"],
    dashboardLink: "/dashboard/seo",
    title: "SEO tasks generated for project.",
    checklist: [
      { id: "seo1", title: "Keyword Research & Strategy", completed: false },
      { id: "seo2", title: "On-Page Optimization", completed: false },
      { id: "seo3", title: "Technical Audit & Fixes", completed: false },
      { id: "seo4", title: "Backlink Setup", completed: false },
    ],
  },
  social: {
    services: ["social", "social_media"],
    taskTypes: ["Social_Media", "social_media"],
    assignedRole: "social_media",
    bodyKeys: ["socialLeaderId"],
    leaderRoles: ["team_leader_social_media"],
    dashboardLink: "/dashboard/social-media",
    title: "Social tasks generated for project.",
    checklist: [
      { id: "sm1", title: "Competitor Analysis", completed: false },
      { id: "sm2", title: "Content Calendar Creation", completed: false },
      { id: "sm3", title: "Prepare Design Assets", completed: false },
      { id: "sm4", title: "Schedule Initial Posts", completed: false },
    ],
  },
  media: {
    services: ["media", "media_buyer", "media_buying"],
    taskTypes: ["Media_Buyer", "media_buyer", "media_buying"],
    assignedRole: "media_buying",
    bodyKeys: ["mediaLeaderId", "mediaBuyerLeaderId"],
    leaderRoles: ["team_leader_media_buyer"],
    dashboardLink: "/dashboard/media-buyer",
    title: "Media tasks generated for project.",
    checklist: [
      { id: "mb1", title: "Audience Targeting Research", completed: false },
      { id: "mb2", title: "Pixel & Tracking Setup", completed: false },
      { id: "mb3", title: "Ad Campaign Launch", completed: false },
      { id: "mb4", title: "A/B Testing & Optimization", completed: false },
    ],
  },
} as const;

function getBodyLeaderId(body: any, keys: readonly string[]) {
  for (const key of keys) {
    if (typeof body[key] === "string" && body[key].trim()) return body[key].trim();
  }
  return null;
}

async function resolveGenerationLeader(candidateId: string | null, allowedRoles: readonly string[]) {
  if (candidateId) {
    const leader = await findUserForTaskAssignment(candidateId);
    if (!leader || leader.status !== "Active" || !allowedRoles.includes(leader.role)) {
      return null;
    }
    return leader.id;
  }

  const leader = await findFirstActiveUserByRoles([...allowedRoles]);
  return leader?.id || null;
}

function parseServices(servicesJson: string) {
  try {
    const parsed = JSON.parse(servicesJson);
    return Array.isArray(parsed) ? parsed.filter((service): service is string => typeof service === "string") : [];
  } catch {
    return [];
  }
}

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

export async function updateTask(input: {
  taskId: string;
  userId: string;
  userName?: string | null;
  userRole: string;
  body: any;
}) {
  const existingTask = await findTaskForUpdate(input.taskId);
  if (!existingTask) return { status: "not_found" as const };

  const isAdmin =
    ["super_admin", "head_account_manager"].includes(input.userRole) ||
    (input.userRole === "head_technical" && existingTask.project?.headTechnicalId === input.userId) ||
    (input.userRole === "head_seo" && existingTask.project?.headSeoId === input.userId);
  const isTeamLeader = existingTask.leaderId === input.userId;
  const isAssignedAgent = existingTask.agentId === input.userId;
  const isProjectAM = existingTask.project?.accountManagerId === input.userId;

  if (!isAdmin && !isTeamLeader && !isAssignedAgent && !isProjectAM) {
    return { status: "forbidden" as const };
  }

  const body = input.body;
  const updateData: any = {};

  if (body.agentId !== undefined) {
    if (!isTeamLeader && !isAdmin) {
      return { status: "agent_reassign_forbidden" as const };
    }
    updateData.agentId = body.agentId;

    if (body.agentId !== null) {
      const agent = await findAgentForTaskUpdate(body.agentId);
      if (agent) {
        if (agent.status !== "Active") {
          return { status: "agent_inactive" as const };
        }

        const allowedRoles = TASK_AGENT_ROLE_MAP[existingTask.taskType] || [];
        if (allowedRoles.length > 0 && !allowedRoles.includes(agent.role)) {
          return { status: "agent_role_invalid" as const, role: agent.role, taskType: existingTask.taskType };
        }

        const dept = AGENT_DEPARTMENT_MAP[agent.role];
        if (dept) {
          await upsertTaskAgentAssignment({
            projectId: existingTask.projectId,
            userId: body.agentId,
            assignedByUserId: input.userId,
            role: agent.role,
            department: dept,
          });
          await backfillReceiptsForNewMember(existingTask.projectId, body.agentId);
        }
      }
    }
  }

  if (body.leaderId !== undefined) {
    if (!isAdmin) {
      return { status: "leader_reassign_forbidden" as const };
    }
    updateData.leaderId = body.leaderId;
  }

  if (body.progressPct !== undefined) {
    const pct = Number(body.progressPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return { status: "invalid_progress" as const };
    }
    updateData.progressPct = pct;
  }

  if (body.checklistItems !== undefined) updateData.checklistItems = body.checklistItems;
  if (body.status !== undefined) {
    const validStatuses = ["pending", "in_progress", "review", "done"];
    if (!validStatuses.includes(body.status)) {
      return { status: "invalid_status" as const, taskStatus: body.status };
    }

    if (body.status === "done" && isAssignedAgent && !isTeamLeader && !isAdmin && !isProjectAM) {
      return { status: "agent_done_forbidden" as const };
    }

    if (["in_progress", "review", "done"].includes(body.status)) {
      const blockers = await checkProjectBlockers(existingTask.projectId);
      if (blockers.isBlocked) {
        return { status: "blocked" as const, warnings: blockers.warnings };
      }
    }

    updateData.status = body.status;
    if (body.status === "in_progress" && !existingTask.startedAt) {
      updateData.startedAt = new Date();
    }
    if (body.status === "done" && body.completedAt === undefined) {
      updateData.completedAt = new Date();
    }
  }
  if (body.priority !== undefined) updateData.priority = body.priority;
  if (body.brief !== undefined) updateData.brief = body.brief;
  if (body.deadline !== undefined) updateData.deadline = body.deadline ? new Date(body.deadline) : null;
  if (body.files !== undefined) {
    const normalizedFiles = normalizeDeliverableFiles(body.files);
    if ("error" in normalizedFiles) {
      return { status: "invalid_files" as const, error: normalizedFiles.error };
    }
    updateData.files = normalizedFiles.value;
  }
  if (body.completedAt !== undefined) updateData.completedAt = body.completedAt ? new Date(body.completedAt) : null;

  const updatedTask = await updateTaskWithProject(input.taskId, updateData);

  if (body.agentId !== undefined && body.agentId !== null) {
    await createTaskNotification({
      userId: body.agentId,
      title: "New Task Assigned",
      message: `A team leader assigned a new project task to your queue.`,
      link: "/dashboard/operations",
    });
    await createTaskProjectLog({
      projectId: existingTask.projectId,
      action: "task_assigned",
      details: `${existingTask.taskType.replace(/_/g, " ")} task assigned to an agent.`,
      userId: input.userId,
    });
  }

  if (body.progressPct !== undefined) {
    const allProjectTasks = await findProjectTasksForProgress(updatedTask.projectId);
    const { seo: avgSeo, social: avgSocial, media: avgMedia, overall: overallProgress } =
      computeDepartmentProgress(
        allProjectTasks.map((task) => ({
          id: task.id,
          taskType: task.taskType,
          parentTaskId: task.parentTaskId,
          progressPct: task.progressPct,
        }))
      );

    let newStatus = updatedTask.project.projectStatus;

    if (overallProgress === 100) {
      newStatus = "completed";
    } else if (
      updatedTask.project.finalDeadline &&
      new Date() > new Date(updatedTask.project.finalDeadline) &&
      overallProgress < 100
    ) {
      newStatus = "delayed";
    } else if (updatedTask.project.projectStatus === "setup" || updatedTask.project.projectStatus === "new") {
      newStatus = "in_progress";
    }

    await updateProjectProgress({
      projectId: updatedTask.projectId,
      seoProgress: avgSeo,
      socialMediaProgress: avgSocial,
      mediaBuyerProgress: avgMedia,
      projectStatus: newStatus,
    });

    if (body.progressPct === 100) {
      await createTaskProjectLog({
        projectId: updatedTask.projectId,
        action: "progress_updated",
        details: `Task "${updatedTask.taskType}" completed by ${input.userName || input.userId}.`,
        userId: input.userId,
      });

      const notificationTargets = [
        updatedTask.project.accountManagerId && {
          userId: updatedTask.project.accountManagerId,
          title: "Task Completed",
          message: `Task "${updatedTask.taskType}" completed. Overall: ${overallProgress.toFixed(0)}%`,
          type: "task_progress",
          link: "/dashboard/operations",
        },
        updatedTask.leaderId && {
          userId: updatedTask.leaderId,
          title: "Task Completed",
          message: `Agent completed task "${updatedTask.taskType}".`,
          type: "task_progress",
          link: "/dashboard/operations",
        },
      ].filter(Boolean);

      if (notificationTargets.length > 0) {
        await createTaskNotifications(notificationTargets as any[]);
      }
    }
  }

  if (body.status === "review") {
    const reviewTargets = [
      updatedTask.leaderId &&
        updatedTask.leaderId !== input.userId && {
          userId: updatedTask.leaderId,
          title: "Task Ready for Review",
          message: `Task "${updatedTask.taskType.replace(/_/g, " ")}" was submitted for your review.`,
          type: "task_review",
          link: "/dashboard/operations",
        },
      updatedTask.project?.accountManagerId &&
        updatedTask.project.accountManagerId !== input.userId && {
          userId: updatedTask.project.accountManagerId,
          title: "Task Ready for Review",
          message: `Task "${updatedTask.taskType.replace(/_/g, " ")}" was submitted for review.`,
          type: "task_review",
          link: "/dashboard/operations",
        },
    ].filter(Boolean);
    if (reviewTargets.length > 0) {
      await createTaskNotifications(reviewTargets as any[]);
    }
  }

  if (body.status === "done" && updatedTask.project?.accountManagerId) {
    await createTaskNotification({
      userId: updatedTask.project.accountManagerId,
      title: "Task Completed",
      message: `Task "${updatedTask.taskType}" has been marked as done.`,
      type: "task_progress",
      link: "/dashboard/operations",
    });
  }

  return { status: "ok" as const, task: updatedTask };
}

export async function generateProjectTasks(input: {
  userId: string;
  userRole: string;
  body: any;
}) {
  const { projectId, packageType, parentTaskId, brief, deadline, priority } = input.body;

  if (!projectId) {
    return { status: "missing_project_id" as const };
  }

  const projectAllowed = await userCanAccessProject(input.userId, input.userRole, projectId);
  if (!projectAllowed) {
    return { status: "project_forbidden" as const };
  }

  if (parentTaskId) {
    const taskType = packageType || "graphic_design";
    const subTaskConfig = SUB_TASK_TYPES[taskType];
    if (!subTaskConfig) {
      return { status: "unsupported_sub_task_type" as const };
    }

    const parentTask = await findParentTaskForSubTask(parentTaskId);
    if (!parentTask || parentTask.projectId !== projectId) {
      return { status: "parent_task_invalid" as const };
    }

    const canCreateSubTask =
      input.userRole === "super_admin" ||
      input.userRole === "head_account_manager" ||
      input.userRole === "account_manager" ||
      parentTask.leaderId === input.userId ||
      parentTask.agentId === input.userId;

    if (!canCreateSubTask) {
      return { status: "sub_task_forbidden" as const };
    }

    const leaderId = getBodyLeaderId(input.body, subTaskConfig.leaderKeys);
    const resolvedLeaderId = await resolveGenerationLeader(leaderId, subTaskConfig.leaderRoles);
    if (!resolvedLeaderId) {
      return { status: "sub_task_leader_missing" as const, label: subTaskConfig.label };
    }

    const defaultChecklist = JSON.stringify([
      { id: "st1", title: "Review Brief & Requirements", completed: false },
      { id: "st2", title: "Create Initial Draft", completed: false },
      { id: "st3", title: "Internal Review", completed: false },
      { id: "st4", title: "Final Delivery", completed: false },
    ]);

    const subTask = await createSubTaskWithNotification({
      projectId,
      leaderId: resolvedLeaderId,
      taskType,
      checklistItems: defaultChecklist,
      parentTaskId,
      requesterRole: input.userRole,
      brief,
      deadline,
      priority,
      notificationTitle: "New Design Request",
      notificationMessage: `${input.userRole.replace(/_/g, " ")} requested: ${taskType.replace(/_/g, " ")}${
        brief ? ` - ${brief.substring(0, 50)}` : ""
      }`,
    });

    return { status: "sub_task_created" as const, subTask };
  }

  if (!STANDARD_GENERATOR_ROLES.has(input.userRole)) {
    return { status: "generator_role_forbidden" as const };
  }

  const project = await findProjectForTaskGeneration(projectId);
  if (!project) return { status: "project_not_found" as const };

  const pkg = await findPackageByName(project.package);
  if (!pkg) return { status: "package_not_found" as const };

  const services = parseServices(pkg.servicesJson);
  const existingTasks = await findExistingTaskTypes(projectId);
  const existingTaskTypes = new Set(existingTasks.map((task) => task.taskType));

  const tasksToCreate: any[] = [];
  const notificationsToCreate: any[] = [];
  const missingLeaders: string[] = [];
  const skippedExisting: string[] = [];
  const defaultDeadline = project.finalDeadline || new Date(Date.now() + 7 * 86400000);

  for (const [serviceName, config] of Object.entries(SERVICE_CONFIG)) {
    const serviceIncluded = config.services.some((service) => services.includes(service));
    if (!serviceIncluded) continue;

    const hasExistingTask = config.taskTypes.some((taskType) => existingTaskTypes.has(taskType));
    if (hasExistingTask) {
      skippedExisting.push(serviceName);
      continue;
    }

    const requestedLeaderId = getBodyLeaderId(input.body, config.bodyKeys);
    const leaderId = await resolveGenerationLeader(requestedLeaderId, config.leaderRoles);
    if (!leaderId) {
      missingLeaders.push(serviceName);
      continue;
    }

    tasksToCreate.push({
      projectId,
      leaderId,
      taskType: config.taskTypes[0],
      checklistItems: JSON.stringify(config.checklist),
      deadline: defaultDeadline,
      requesterRole: input.userRole,
      assignedRole: config.assignedRole,
      status: "pending",
      priority: "Medium",
    });
    notificationsToCreate.push({
      userId: leaderId,
      title: "New Assignment",
      message: config.title,
      type: "task_assigned",
      link: config.dashboardLink,
    });
  }

  if (tasksToCreate.length === 0) {
    if (skippedExisting.length > 0) {
      return { status: "none_created_existing" as const, skippedExisting };
    }
    return { status: "none_created" as const, missingLeaders };
  }

  await createGeneratedTasks(tasksToCreate);
  if (notificationsToCreate.length > 0) {
    await createTaskNotifications(notificationsToCreate);
  }

  await updateProjectStatus(projectId, "assigned");

  await createTaskProjectLog({
    projectId,
    action: "assigned",
    details: `Services assigned to ${tasksToCreate.length} leaders.${
      missingLeaders.length ? ` Missing leaders: ${missingLeaders.join(", ")}` : ""
    }`,
    userId: input.userId,
  });

  return {
    status: "generated" as const,
    count: tasksToCreate.length,
    skippedExisting,
    missingLeaders,
  };
}
