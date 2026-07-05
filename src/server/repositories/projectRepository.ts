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

export function findProjectLogs(projectId: string) {
  return prisma.projectLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export function findProjectFiles(projectId: string) {
  return prisma.projectFile.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export function createProjectFile(input: {
  projectId: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: string;
}) {
  return prisma.projectFile.create({ data: input });
}

export function findProjectAccountManagerId(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { accountManagerId: true },
  });
}

/** The full 360° project payload used by the client journey screen. */
export function findProjectDetailFull(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      accountManager: { select: { name: true, role: true } },
      headTechnical: { select: { name: true, role: true } },
      headSeo: { select: { name: true, role: true } },
      deal: {
        include: {
          lead: {
            include: {
              callLogs: { include: { agent: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
              meetings: { include: { teleAgent: { select: { name: true } }, salesAgent: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
              deals: { include: { salesAgent: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
            },
          },
          salesAgent: { select: { name: true, role: true } },
          installments: true,
        },
      },
      tasks: {
        include: {
          leader: { select: { name: true, role: true } },
          agent: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      globalNotes: {
        orderBy: { createdAt: "desc" },
      },
      files: true,
      logs: true,
    },
  });
}

export function findActiveHeadAccountManagerCandidate(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
}

export function updateProjectHeadAccountManager(projectId: string, headAccountManagerId: string | null) {
  return prisma.project.update({
    where: { id: projectId },
    data: { headAccountManagerId },
    select: {
      id: true,
      headAccountManagerId: true,
      deal: { select: { lead: { select: { name: true } } } },
    },
  });
}

export function findProjectWithLeadName(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: { deal: { include: { lead: true } } },
  });
}

export function findAccountManagerCandidate(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

/** Transfer a project to a new AM: update, audit log and both-side notifications. */
export function reassignProjectAccountManagerWithLog(input: {
  projectId: string;
  newAccountManagerId: string;
  newAccountManagerName: string;
  previousAccountManagerId: string | null;
  clientName: string;
  actorId: string;
  actorName: string;
}) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: input.projectId },
      data: { accountManagerId: input.newAccountManagerId },
    });

    await tx.projectLog.create({
      data: {
        projectId: input.projectId,
        userId: input.actorId,
        action: "client_reassigned",
        details: `Client reassigned from ${input.previousAccountManagerId || "unassigned"} to ${input.newAccountManagerName} by ${input.actorName}`,
      },
    });

    await tx.notification.create({
      data: {
        userId: input.newAccountManagerId,
        title: "Client Assigned",
        message: `Client "${input.clientName}" has been assigned to you by ${input.actorName}`,
        type: "client_reassigned",
        relatedId: input.projectId,
      },
    });

    if (input.previousAccountManagerId && input.previousAccountManagerId !== input.newAccountManagerId) {
      await tx.notification.create({
        data: {
          userId: input.previousAccountManagerId,
          title: "Client Reassigned",
          message: `Client "${input.clientName}" has been transferred to ${input.newAccountManagerName} by ${input.actorName}`,
          type: "client_reassigned",
          relatedId: input.projectId,
        },
      });
    }

    return updated;
  });
}

export function findTeamAssignmentsForProject(projectId: string) {
  return prisma.teamAssignment.findMany({
    where: { projectId },
    include: {
      user: { select: { id: true, name: true, role: true, email: true } },
      assignedByUser: { select: { id: true, name: true, role: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
}

export function findTeamAssignmentForRemoval(assignmentId: string) {
  return prisma.teamAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      user: { select: { name: true, role: true } },
      project: { select: { accountManagerId: true, headTechnicalId: true, headSeoId: true } },
    },
  });
}

export function removeTeamAssignmentWithLog(input: {
  assignmentId: string;
  projectId: string;
  details: string;
  userId: string;
}) {
  return prisma.$transaction([
    prisma.teamAssignment.update({
      where: { id: input.assignmentId },
      data: { status: "removed", removedAt: new Date() },
    }),
    prisma.projectLog.create({
      data: {
        projectId: input.projectId,
        action: "team_removed",
        details: input.details,
        userId: input.userId,
      },
    }),
  ]);
}
