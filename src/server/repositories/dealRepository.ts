import { prisma } from "@/lib/prisma";
import { buildNewProjectData, projectSetupLogDetails } from "@/lib/projectSetup";

export function findDealLead(leadId: string) {
  return prisma.lead.findUnique({ where: { id: leadId } });
}

export function findGatewayFeeConfig() {
  return prisma.systemConfig.findUnique({ where: { key: "gateway_fee_pct" } });
}

export function createDealWithProject(input: {
  lead: any;
  leadId: string;
  salesAgentId: string;
  packageType: string;
  contractStart: string;
  contractEnd: string;
  totalAmount: number;
  firstAmount: number | null;
  paymentMethod: string;
  paymentBreakdown?: string | null;
  netTarget: number;
  contractImageUrl: string | null;
  receiptUrl: string | null;
  installments: any;
}) {
  return prisma.$transaction(async (tx) => {
    const createdDeal = await tx.deal.create({
      data: {
        leadId: input.leadId,
        salesAgentId: input.salesAgentId,
        package: input.packageType,
        contractStart: new Date(input.contractStart),
        contractEnd: new Date(input.contractEnd),
        totalAmount: input.totalAmount,
        firstAmount: input.firstAmount,
        paymentMethod: input.paymentMethod,
        paymentBreakdown: input.paymentBreakdown ?? null,
        netTarget: input.netTarget,
        contractImageUrl: input.contractImageUrl,
        receiptUrl: input.receiptUrl,
        status: "Closed_Won",
        installments:
          input.installments && input.installments.length > 0
            ? {
                create: input.installments.map((installment: any) => ({
                  amount: parseFloat(installment.amount),
                  dueDate: new Date(installment.date),
                  isPaid: false,
                })),
              }
            : undefined,
      },
    });

    await tx.lead.update({
      where: { id: input.leadId },
      data: { status: "Closed_Won" },
    });

    const createdProject = await tx.project.create({
      data: buildNewProjectData(createdDeal, input.lead.niche, null),
    });

    await tx.projectLog.create({
      data: {
        projectId: createdProject.id,
        action: "setup",
        details: projectSetupLogDetails(createdDeal.package),
        userId: input.salesAgentId,
      },
    });

    return { deal: createdDeal, project: createdProject };
  });
}

export function findDealCloserForManagerNotification(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, directManagerId: true },
  });
}

export function createDealClosedNotification(input: {
  managerId: string;
  message: string;
  link: string;
}) {
  return prisma.notification.create({
    data: {
      userId: input.managerId,
      title: "Deal Closed!",
      message: input.message,
      link: input.link,
    },
  });
}

export function findClosedWonDealsForList(whereClause: any) {
  return prisma.deal.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      lead: {
        include: {
          teleAgent: { select: { name: true, id: true } },
          callLogs: {
            orderBy: { createdAt: "asc" },
            include: {
              agent: { select: { name: true } },
            },
          },
          meetings: {
            orderBy: { createdAt: "asc" },
            include: {
              teleAgent: { select: { name: true } },
              salesAgent: { select: { name: true } },
            },
          },
        },
      },
      salesAgent: { select: { name: true, id: true } },
      installments: { orderBy: { dueDate: "asc" } },
    },
  });
}
