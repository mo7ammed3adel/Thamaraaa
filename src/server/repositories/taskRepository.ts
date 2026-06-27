import { prisma } from "@/lib/prisma";

export function findTaskForFlag(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
}

export function findTaskForReassign(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
}

export function findUserForTaskAssignment(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, status: true },
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

export function reassignTaskWithNotificationsAndLog(input: {
  taskId: string;
  projectId: string;
  taskType: string;
  taskStatus: string;
  leaderId: string;
  newAgentId: string;
  newAgentName: string;
  newAgentRole: string;
  previousAgentId: string | null;
  agentDepartment?: string;
  userId: string;
  userName: string;
}) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: input.taskId },
      data: {
        agentId: input.newAgentId,
        flagReason: null,
        flaggedAt: null,
        flaggedByUserId: null,
        status: input.taskStatus === "done" ? "done" : "pending",
      },
    });

    if (input.agentDepartment) {
      await tx.teamAssignment.upsert({
        where: {
          projectId_userId: { projectId: input.projectId, userId: input.newAgentId },
        },
        update: {
          role: input.newAgentRole,
          department: input.agentDepartment,
          status: "active",
          removedAt: null,
          assignedByUserId: input.userId,
        },
        create: {
          projectId: input.projectId,
          userId: input.newAgentId,
          assignedByUserId: input.userId,
          role: input.newAgentRole,
          department: input.agentDepartment,
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: input.newAgentId,
        title: "Task Assigned",
        message: `You have been assigned task "${input.taskType}" by ${input.userName}`,
        type: "task_reassigned",
        relatedId: input.taskId,
      },
    });

    if (input.previousAgentId && input.previousAgentId !== input.newAgentId) {
      await tx.notification.create({
        data: {
          userId: input.previousAgentId,
          title: "Task Reassigned",
          message: `Task "${input.taskType}" has been reassigned to another agent by ${input.userName}`,
          type: "task_reassigned",
          relatedId: input.taskId,
        },
      });
    }

    if (input.projectId) {
      await tx.projectLog.create({
        data: {
          projectId: input.projectId,
          userId: input.userId,
          action: "task_reassigned",
          details: `Task "${input.taskType}" reassigned to ${input.newAgentName} by ${input.userName}`,
        },
      });
    }

    return updated;
  });
}
