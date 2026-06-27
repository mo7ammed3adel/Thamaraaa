import { canFlagTask } from "@/lib/distribution";
import { findTaskForFlag, flagTaskWithNotificationAndLog } from "@/server/repositories/taskRepository";

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
