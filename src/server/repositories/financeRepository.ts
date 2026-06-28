import { prisma } from "@/lib/prisma";

export function findFinanceOverviewDeals() {
  return prisma.deal.findMany({
    where: { status: { in: ["Pending", "Closed_Won"] } },
    include: {
      lead: true,
      salesAgent: { select: { name: true } },
      installments: { orderBy: { dueDate: "asc" } },
    },
  });
}

export function findPendingInstallments() {
  return prisma.installment.findMany({
    where: { isPaid: false },
    include: { deal: { include: { lead: true } } },
    orderBy: { dueDate: "asc" },
  });
}

export function findCommissionsByMonth(month: string) {
  return prisma.commission.findMany({
    where: { month },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          level: true,
          hrRecord: { select: { monthlyTarget: true, baseSalary: true } },
        },
      },
    },
    orderBy: { netPayout: "desc" },
  });
}

export function findFinancePayrollHrRecords() {
  return prisma.hrRecord.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          level: true,
          status: true,
        },
      },
    },
  });
}

export async function aggregateFinanceApprovedDeductionsByUser(start: Date, end: Date) {
  const rows = await prisma.attendance.groupBy({
    by: ["userId"],
    where: { deductionApproved: true, date: { gte: start, lt: end } },
    _sum: { deductionDraft: true },
  });
  return new Map(rows.map((row) => [row.userId, row._sum.deductionDraft || 0]));
}

export function findFinancePayrollCommissions(month: string) {
  return prisma.commission.findMany({ where: { month } });
}

export function findCommissionsForExport(month: string) {
  return prisma.commission.findMany({
    where: { month },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          level: true,
          hrRecord: { select: { monthlyTarget: true, baseSalary: true } },
        },
      },
    },
    orderBy: { netPayout: "desc" },
  });
}

export function findCommissionForEdit(id: string) {
  return prisma.commission.findUnique({
    where: { id },
    include: { user: { include: { hrRecord: true } } },
  });
}

export function updateCommission(id: string, data: any) {
  return prisma.commission.update({ where: { id }, data });
}

export function findInstallmentForUpdate(id: string) {
  return prisma.installment.findUnique({
    where: { id },
    include: { deal: { include: { projects: { select: { id: true } } } } },
  });
}

export function updateInstallmentPaidWithLog(input: {
  id: string;
  isPaid: boolean;
  userId: string;
  projectId?: string;
  amount: number;
}) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.installment.update({
      where: { id: input.id },
      data: { isPaid: input.isPaid },
      include: { deal: true },
    });

    if (input.projectId) {
      await tx.projectLog.create({
        data: {
          projectId: input.projectId,
          userId: input.userId,
          action: "installment_updated",
          details: `Installment ${input.id} marked as ${
            input.isPaid ? "paid" : "unpaid"
          }. Amount: ${input.amount} SAR`,
        },
      });
    }

    return updated;
  });
}
