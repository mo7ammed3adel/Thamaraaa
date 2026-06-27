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
    select: { id: true, accountManagerId: true, headTechnicalId: true },
  });
}

export function findActiveAccountManager(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true },
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
