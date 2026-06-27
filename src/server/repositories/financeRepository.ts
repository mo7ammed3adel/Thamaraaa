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
