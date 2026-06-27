import { prisma } from "@/lib/prisma";

export function findTaskForFlag(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
}

export function flagTaskWithNotificationAndLog(input: {
  taskId: string;
  projectId: string | null;
  leaderId: string;
  taskType: string;
  reason: string;
  userId: string;
  userName: string;
}) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: input.taskId },
      data: {
        flagReason: input.reason,
        flaggedAt: now,
        flaggedByUserId: input.userId,
        agentId: null,
        status: "pending",
      },
    });

    await tx.notification.create({
      data: {
        userId: input.leaderId,
        title: "Task Flagged",
        message: `${input.userName} flagged task "${input.taskType}" — Reason: ${input.reason}`,
        type: "task_flagged",
        relatedId: input.taskId,
      },
    });

    if (input.projectId) {
      await tx.projectLog.create({
        data: {
          projectId: input.projectId,
          userId: input.userId,
          action: "task_flagged",
          details: `Task "${input.taskType}" flagged by ${input.userName}: ${input.reason}`,
        },
      });
    }

    return updated;
  });
}
