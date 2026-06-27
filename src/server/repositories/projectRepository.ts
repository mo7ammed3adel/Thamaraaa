import { prisma } from "@/lib/prisma";
import { buildNewProjectData, projectSetupLogDetails } from "@/lib/projectSetup";

export function findProjectLifecycleAuth(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, lifecycleState: true, accountManagerId: true },
  });
}

export function updateProjectLifecycleWithLog(input: {
  projectId: string;
  fromState: string;
  toState: string;
  userId: string;
  userName: string;
  userRole: string;
}) {
  return prisma.$transaction([
    prisma.project.update({
      where: { id: input.projectId },
      data: { lifecycleState: input.toState },
    }),
    prisma.projectLog.create({
      data: {
        projectId: input.projectId,
        action: "lifecycle_changed",
        details: JSON.stringify({
          from: input.fromState,
          to: input.toState,
          changedBy: input.userName,
          changedByRole: input.userRole,
        }),
        userId: input.userId,
      },
    }),
  ]);
}

export function findProjectStatusAuth(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, accountManagerId: true, headTechnicalId: true, headSeoId: true },
  });
}

export function findActiveAccountManager(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true },
  });
}

export function findActiveUserForAssignment(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, name: true },
  });
}

export function updateProjectFields(projectId: string, data: Record<string, unknown>) {
  return prisma.project.update({
    where: { id: projectId },
    data,
  });
}

export function createProjectLog(input: {
  projectId: string;
  action: string;
  details: string;
  userId: string;
}) {
  return prisma.projectLog.create({
    data: input,
  });
}

export function findProjectSetupAuth(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { accountManagerId: true },
  });
}

export function findProjectByDealId(dealId: string) {
  return prisma.project.findFirst({ where: { dealId } });
}

export function findDealForProjectSetup(dealId: string) {
  return prisma.deal.findUnique({
    where: { id: dealId },
    include: { lead: { select: { name: true } } },
  });
}

export function createProjectFromDealWithLog(input: {
  deal: Parameters<typeof buildNewProjectData>[0];
  niche: string | null;
  deadline: Date | null;
  packageName: string;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: buildNewProjectData(input.deal, input.niche, input.deadline),
    });
    await tx.projectLog.create({
      data: {
        projectId: project.id,
        action: "setup",
        details: projectSetupLogDetails(input.packageName),
        userId: input.userId,
      },
    });
    return project;
  });
}

export function findProjectTeamAssignmentScope(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, headTechnicalId: true, headSeoId: true },
  });
}

export function replaceProjectTeamAssignment(input: {
  projectId: string;
  userId: string;
  userName: string;
  targetUserId: string;
  targetUserName: string;
  targetUserRole: string;
  department: string;
  assignedRoleType: string;
  dbDepartments: string[];
  taskTypes: string[];
  canonicalDepartment: string;
}) {
  return prisma.$transaction(async (tx) => {
    const roleContains = input.assignedRoleType === "leader" ? "leader" : "agent";
    const oldAssignments = await tx.teamAssignment.findMany({
      where: {
        projectId: input.projectId,
        department: { in: input.dbDepartments },
        status: "active",
        role: { contains: roleContains },
      },
    });

    if (oldAssignments.length > 0) {
      await tx.teamAssignment.deleteMany({
        where: { id: { in: oldAssignments.map((assignment) => assignment.id) } },
      });
    }

    const existingUserAssignment = await tx.teamAssignment.findUnique({
      where: {
        projectId_userId: { projectId: input.projectId, userId: input.targetUserId },
      },
    });

    const assignment = existingUserAssignment
      ? await tx.teamAssignment.update({
          where: { id: existingUserAssignment.id },
          data: {
            department: input.canonicalDepartment,
            role: input.targetUserRole,
            status: "active",
            assignedByUserId: input.userId,
          },
        })
      : await tx.teamAssignment.create({
          data: {
            projectId: input.projectId,
            userId: input.targetUserId,
            assignedByUserId: input.userId,
            role: input.targetUserRole,
            department: input.canonicalDepartment,
            status: "active",
          },
        });

    const updateResult = await tx.task.updateMany({
      where: {
        projectId: input.projectId,
        taskType: { in: input.taskTypes },
      },
      data:
        input.assignedRoleType === "leader"
          ? { leaderId: input.targetUserId }
          : { agentId: input.targetUserId },
    });

    await tx.projectLog.create({
      data: {
        projectId: input.projectId,
        action: "team_assigned",
        details: JSON.stringify({
          message: `Assigned ${input.targetUserName} as ${input.assignedRoleType} for ${input.department}`,
          assignedUser: input.targetUserName,
          assignedUserRole: input.targetUserRole,
          department: input.department,
          assignedBy: input.userName,
          tasksUpdated: updateResult.count,
        }),
        userId: input.userId,
      },
    });

    await tx.notification.create({
      data: {
        userId: input.targetUserId,
        title: "Team Assignment",
        message: `You were assigned as ${input.assignedRoleType} for ${input.department} by ${input.userName}.`,
        type: "project_assigned",
        link: `/dashboard/operations`,
      },
    });

    return { assignment, tasksUpdated: updateResult.count };
  });
}

export function findProjectAgentAssignmentScope(projectId: string, userId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      headTechnicalId: true,
      headSeoId: true,
      teamAssignments: {
        where: { userId, status: "active" },
        select: { id: true },
      },
      tasks: {
        where: { leaderId: userId },
        select: { id: true },
        take: 1,
      },
    },
  });
}

export function assignDepartmentAgent(input: {
  projectId: string;
  userId: string;
  userName: string;
  agentUserId: string;
  agentUserName: string;
  agentRole: string;
  department: string;
  taskTypes: string[];
  agentRoles: string[];
  dashboardLink: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.teamAssignment.deleteMany({
      where: {
        projectId: input.projectId,
        department: input.department,
        status: "active",
        role: { in: input.agentRoles },
        userId: { not: input.agentUserId },
      },
    });

    const existingAssignment = await tx.teamAssignment.findUnique({
      where: { projectId_userId: { projectId: input.projectId, userId: input.agentUserId } },
    });

    const assignment = existingAssignment
      ? await tx.teamAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            assignedByUserId: input.userId,
            role: input.agentRole,
            department: input.department,
            status: "active",
            removedAt: null,
          },
        })
      : await tx.teamAssignment.create({
          data: {
            projectId: input.projectId,
            userId: input.agentUserId,
            assignedByUserId: input.userId,
            role: input.agentRole,
            department: input.department,
          },
        });

    const updateResult = await tx.task.updateMany({
      where: {
        projectId: input.projectId,
        taskType: { in: input.taskTypes },
      },
      data: { agentId: input.agentUserId },
    });

    await tx.projectLog.create({
      data: {
        projectId: input.projectId,
        action: "team_assigned",
        details: JSON.stringify({
          assignedUser: input.agentUserName,
          assignedRole: input.agentRole,
          department: input.department,
          assignedBy: input.userName,
          taskTypes: input.taskTypes,
          tasksUpdated: updateResult.count,
        }),
        userId: input.userId,
      },
    });

    await tx.notification.create({
      data: {
        userId: input.agentUserId,
        type: "task_assigned",
        message: `You have been assigned ${input.department.replace(/_/g, " ")} work by ${input.userName}`,
        title: "New Assignment",
        link: input.dashboardLink,
      },
    });

    return { assignment, tasksUpdated: updateResult.count };
  });
}

export function findProjectTeamAssignment(projectId: string, userId: string) {
  return prisma.teamAssignment.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export function createDistributionTeamAssignmentWithLog(input: {
  projectId: string;
  userId: string;
  userName: string;
  targetUserId: string;
  targetUserName: string;
  targetUserRole: string;
  department: string;
}) {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.teamAssignment.create({
      data: {
        projectId: input.projectId,
        userId: input.targetUserId,
        assignedByUserId: input.userId,
        role: input.targetUserRole,
        department: input.department,
      },
    });

    await tx.projectLog.create({
      data: {
        projectId: input.projectId,
        action: "team_assigned",
        details: JSON.stringify({
          assignedUser: input.targetUserName,
          assignedRole: input.targetUserRole,
          department: input.department,
          assignedBy: input.userName,
        }),
        userId: input.userId,
      },
    });

    return assignment;
  });
}

export function updateProjectDistributionWithLog(input: {
  projectId: string;
  updateData: Record<string, unknown>;
  assignmentDescription: string;
  userId: string;
  userName: string;
  userRole: string;
}) {
  return prisma.$transaction([
    prisma.project.update({ where: { id: input.projectId }, data: input.updateData }),
    prisma.projectLog.create({
      data: {
        projectId: input.projectId,
        action: "assigned",
        details: JSON.stringify({
          description: input.assignmentDescription,
          assignedBy: input.userName,
          assignedByRole: input.userRole,
        }),
        userId: input.userId,
      },
    }),
  ]);
}

export function createProjectAssignmentNotification(input: {
  userId: string;
  title: string;
  message: string;
  type: string;
  link: string;
}) {
  return prisma.notification.create({ data: input });
}
