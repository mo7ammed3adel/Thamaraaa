import { prisma } from "@/lib/prisma";

export function findTasksForList(whereClause: any) {
  return prisma.task.findMany({
    where: whereClause,
    include: {
      leader: true,
      agent: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

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

export function findProjectForSelfTask(projectId: string, userId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      deal: { include: { lead: { select: { name: true } } } },
      teamAssignments: { where: { userId, status: "active" } },
      tasks: { where: { agentId: userId }, select: { id: true } },
    },
  });
}

export function findActiveTeamAssignmentByRole(projectId: string, role: string) {
  return prisma.teamAssignment.findFirst({
    where: {
      projectId,
      role,
      status: "active",
      user: { status: "Active" },
    },
    select: { userId: true },
  });
}

export function findFirstActiveUserByRoles(roles: string[]) {
  return prisma.user.findFirst({
    where: { role: { in: roles }, status: "Active" },
    select: { id: true },
  });
}

export function findProjectHeadSeo(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { headSeoId: true },
  });
}

export function findProjectLifecycleState(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { lifecycleState: true },
  });
}

export function findProjectNameForTask(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: { deal: { include: { lead: true } } },
  });
}

export function createTaskRecord(data: any) {
  return prisma.task.create({ data });
}

export function createTaskProjectLog(input: {
  projectId: string;
  action: string;
  details: string;
  userId: string;
}) {
  return prisma.projectLog.create({ data: input });
}

export function createTaskNotification(input: {
  userId: string;
  type?: string;
  title: string;
  message: string;
  link?: string | null;
  relatedId?: string | null;
}) {
  return prisma.notification.create({ data: input });
}

export function createTaskNotifications(data: any[]) {
  return prisma.notification.createMany({ data });
}

export function findTaskForUpdate(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      leaderId: true,
      agentId: true,
      projectId: true,
      taskType: true,
      startedAt: true,
      project: { select: { accountManagerId: true, headTechnicalId: true, headSeoId: true } },
    },
  });
}

export function findAgentForTaskUpdate(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
}

export function upsertTaskAgentAssignment(input: {
  projectId: string;
  userId: string;
  assignedByUserId: string;
  role: string;
  department: string;
}) {
  return prisma.teamAssignment.upsert({
    where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
    update: { status: "active" },
    create: input,
  });
}

export function updateTaskWithProject(taskId: string, data: any) {
  return prisma.task.update({
    where: { id: taskId },
    data,
    include: { project: true },
  });
}

export function findProjectTasksForProgress(projectId: string) {
  return prisma.task.findMany({ where: { projectId } });
}

export function updateProjectProgress(input: {
  projectId: string;
  seoProgress: number;
  socialMediaProgress: number;
  mediaBuyerProgress: number;
  projectStatus: string;
}) {
  return prisma.project.update({
    where: { id: input.projectId },
    data: {
      seoProgress: input.seoProgress,
      socialMediaProgress: input.socialMediaProgress,
      mediaBuyerProgress: input.mediaBuyerProgress,
      projectStatus: input.projectStatus,
    },
  });
}

export function findParentTaskForSubTask(parentTaskId: string) {
  return prisma.task.findUnique({
    where: { id: parentTaskId },
    select: { id: true, projectId: true, leaderId: true, agentId: true },
  });
}

export function createSubTaskWithNotification(input: {
  projectId: string;
  leaderId: string;
  taskType: string;
  checklistItems: string;
  parentTaskId: string;
  requesterRole: string;
  brief?: string | null;
  deadline?: string | null;
  priority?: string;
  notificationTitle: string;
  notificationMessage: string;
}) {
  return prisma.$transaction(async (tx) => {
    const subTask = await tx.task.create({
      data: {
        projectId: input.projectId,
        leaderId: input.leaderId,
        taskType: input.taskType,
        checklistItems: input.checklistItems,
        parentTaskId: input.parentTaskId,
        requesterRole: input.requesterRole,
        assignedRole: input.taskType,
        brief: input.brief || null,
        deadline: input.deadline ? new Date(input.deadline) : null,
        priority: input.priority || "Medium",
        status: "pending",
      },
    });

    await tx.notification.create({
      data: {
        userId: input.leaderId,
        title: input.notificationTitle,
        message: input.notificationMessage,
        type: "task_assigned",
        link: "/dashboard/design",
      },
    });

    return subTask;
  });
}

export function findProjectForTaskGeneration(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: { accountManager: true },
  });
}

export function findPackageByName(name: string) {
  return prisma.package.findUnique({ where: { name } });
}

export function findExistingTaskTypes(projectId: string) {
  return prisma.task.findMany({
    where: { projectId },
    select: { taskType: true },
  });
}

export function createGeneratedTasks(data: any[]) {
  return prisma.task.createMany({ data });
}

export function updateProjectStatus(projectId: string, projectStatus: string) {
  return prisma.project.update({
    where: { id: projectId },
    data: { projectStatus },
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

export function createSelfAssignedTaskWithLog(input: {
  projectId: string;
  userId: string;
  userName: string;
  userRole: string;
  taskType: string;
  brief: string;
  priority?: string;
  deadline?: string | null;
  checklistItems: string;
  projectName: string;
}) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        projectId: input.projectId,
        leaderId: input.userId,
        agentId: input.userId,
        taskType: input.taskType,
        brief: input.brief,
        priority: input.priority || "Medium",
        deadline: input.deadline ? new Date(input.deadline) : null,
        checklistItems: input.checklistItems,
        requesterRole: input.userRole,
        assignedRole: input.userRole,
        status: "pending",
        progressPct: 0,
      },
    });

    await tx.projectLog.create({
      data: {
        projectId: input.projectId,
        action: "task_created",
        details: JSON.stringify({
          description: `Self-task created by ${input.userName}: "${input.brief.substring(0, 60)}" for ${input.projectName}`,
          taskType: input.taskType,
          priority: input.priority || "Medium",
          selfAssigned: true,
        }),
        userId: input.userId,
      },
    });

    return task;
  });
}
