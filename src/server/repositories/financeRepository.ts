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
