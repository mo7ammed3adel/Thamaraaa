import {
  backfillReceiptsForNewMember,
  canDistributeTo,
  canFlagTask,
  canReassignTask,
} from "@/lib/distribution";
import {
  findTaskForFlag,
  findTaskForReassign,
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
