import { prisma } from "@/lib/prisma";

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
