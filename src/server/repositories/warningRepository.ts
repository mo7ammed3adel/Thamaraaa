import { prisma } from "@/lib/prisma";

export function findUnreadWarningReceiptsForUser(userId: string) {
  return prisma.warningReceipt.findMany({
    where: { userId, isRead: false, warning: { status: { not: "Resolved" } } },
    include: {
      warning: {
        include: { sender: { select: { id: true, name: true, role: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export function findWarningReceiptForUser(warningId: string, userId: string) {
  return prisma.warningReceipt.findUnique({
    where: { warningId_userId: { warningId, userId } },
  });
}

export function acknowledgeWarningReceipt(input: {
  receiptId: string;
  warningId: string;
  userId: string;
  userName?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const receipt = await tx.warningReceipt.update({
      where: { id: input.receiptId },
      data: { isRead: true, readAt: new Date() },
    });

    await tx.projectLog.create({
      data: {
        projectId: (await tx.warning.findUnique({ where: { id: input.warningId } }))?.projectId || "",
        userId: input.userId,
        action: "warning_read",
        details: `Warning acknowledged by ${input.userName}`,
      },
    });

    return receipt;
  });
}

export function findWarningById(warningId: string) {
  return prisma.warning.findUnique({
    where: { id: warningId },
  });
}

export function resolveWarningWithLog(input: {
  warningId: string;
  projectId: string | null;
  subject: string;
  userId: string;
  userName: string;
  resolvedAt: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const warning = await tx.warning.update({
      where: { id: input.warningId },
      data: {
        status: "Resolved",
        resolvedAt: input.resolvedAt,
        resolvedByUserId: input.userId,
      },
    });

    if (input.projectId) {
      await tx.projectLog.create({
        data: {
          projectId: input.projectId,
          userId: input.userId,
          action: "warning_resolved",
          details: `Warning "${input.subject}" resolved by ${input.userName}`,
        },
      });
    }

    return warning;
  });
}

export function findWarningsForLog(where: any) {
  return prisma.warning.findMany({
    where,
    include: {
      sender: { select: { id: true, name: true, role: true } },
      receipts: { include: { user: { select: { id: true, name: true, role: true } } } },
      project: { include: { deal: { include: { lead: { select: { name: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}
