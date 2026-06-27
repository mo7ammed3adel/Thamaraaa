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
