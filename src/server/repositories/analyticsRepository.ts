import { prisma } from "@/lib/prisma";

type UserRole = "tele_sales_agent" | "sales_agent";

export function findAnalyticsAgents(input: {
  role: UserRole;
  managerRole: string;
  managerId: string;
  managerScopedRole: string;
}) {
  const where: any = { role: input.role };
  if (input.managerRole === input.managerScopedRole) {
    where.directManagerId = input.managerId;
  }

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      specialization: true,
      status: true,
    },
  });
}

export function findAnalyticsAgentForAccess(agentId: string) {
  return prisma.user.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      name: true,
      email: true,
      specialization: true,
      role: true,
      directManagerId: true,
    },
  });
}

export function findTeleSalesTeamCallLogs(agentIds: string[], createdAtFilter: any) {
  return prisma.callLog.findMany({
    where: {
      agentId: { in: agentIds },
      ...createdAtFilter,
    },
    select: {
      agentId: true,
      callStatus: true,
      leadId: true,
      createdAt: true,
    },
  });
}

export function findTeleSalesTeamMeetings(agentIds: string[], meetingDateFilter: any) {
  return prisma.meeting.findMany({
    where: {
      teleAgentId: { in: agentIds },
      ...meetingDateFilter,
    },
    select: {
      teleAgentId: true,
      status: true,
      dealAmount: true,
    },
  });
}

export function findTeleSalesTeamDeals(agentIds: string[], createdAtFilter: any) {
  return prisma.deal.findMany({
    where: {
      lead: { assignedTeleAgentId: { in: agentIds } },
      ...createdAtFilter,
    },
    select: {
      lead: { select: { assignedTeleAgentId: true } },
      totalAmount: true,
      status: true,
    },
  });
}

export function findSalesTeamLeads(agentIds: string[], createdAtFilter: any) {
  return prisma.lead.findMany({
    where: {
      assignedSalesAgentId: { in: agentIds },
      ...createdAtFilter,
    },
    select: {
      assignedSalesAgentId: true,
      status: true,
    },
  });
}

export function findSalesTeamMeetings(agentIds: string[], createdAtFilter: any) {
  return prisma.meeting.findMany({
    where: {
      salesAgentId: { in: agentIds },
      ...createdAtFilter,
    },
    select: {
      salesAgentId: true,
      status: true,
    },
  });
}

export function findSalesTeamDeals(agentIds: string[], createdAtFilter: any) {
  return prisma.deal.findMany({
    where: {
      salesAgentId: { in: agentIds },
      ...createdAtFilter,
    },
    select: {
      salesAgentId: true,
      totalAmount: true,
      status: true,
    },
  });
}

export function findTeleSalesAgentCallLogs(agentId: string, createdAtFilter: any) {
  return prisma.callLog.findMany({
    where: { agentId, ...createdAtFilter },
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { name: true, phone: true, classification: true } },
    },
  });
}

export function findTeleSalesAgentProgressCallLogs(agentId: string, createdAtFilter: any) {
  return prisma.callLog.findMany({
    where: {
      agentId,
      ...createdAtFilter,
    },
    select: {
      id: true,
      callStatus: true,
      notes: true,
      createdAt: true,
      lead: { select: { name: true, phone: true, classification: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function findTeleSalesAgentMeetings(agentId: string, createdAtFilter: any) {
  return prisma.meeting.findMany({
    where: { teleAgentId: agentId, ...createdAtFilter },
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { name: true, phone: true } },
      salesAgent: { select: { name: true } },
    },
  });
}

export function findTeleSalesAgentDeals(agentId: string, createdAtFilter: any) {
  return prisma.deal.findMany({
    where: {
      lead: { assignedTeleAgentId: agentId },
      status: "Closed_Won",
      ...createdAtFilter,
    },
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { name: true, phone: true } },
      salesAgent: { select: { name: true } },
    },
  });
}

export function findSalesAgentLeads(agentId: string, createdAtFilter: any) {
  return prisma.lead.findMany({
    where: {
      assignedSalesAgentId: agentId,
      ...createdAtFilter,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      classification: true,
      status: true,
      createdAt: true,
    },
  });
}

export function findSalesAgentMeetings(agentId: string, createdAtFilter: any) {
  return prisma.meeting.findMany({
    where: { salesAgentId: agentId, ...createdAtFilter },
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { name: true, phone: true } },
      teleAgent: { select: { name: true } },
    },
  });
}

export function findSalesAgentDeals(agentId: string, createdAtFilter: any) {
  return prisma.deal.findMany({
    where: {
      salesAgentId: agentId,
      ...createdAtFilter,
    },
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { name: true, phone: true } },
    },
  });
}

export function countTeleSalesAgentLeads(agentId: string, createdAtFilter: any) {
  return prisma.lead.count({
    where: {
      assignedTeleAgentId: agentId,
      ...createdAtFilter,
    },
  });
}

export function countTeleSalesAgentMeetings(agentId: string, createdAtFilter: any) {
  return prisma.meeting.count({
    where: {
      teleAgentId: agentId,
      ...createdAtFilter,
    },
  });
}

export function countSalesAgentLeads(agentId: string, createdAtFilter: any) {
  return prisma.lead.count({
    where: {
      assignedSalesAgentId: agentId,
      ...createdAtFilter,
    },
  });
}

export function findSalesAgentProgressMeetings(agentId: string, createdAtFilter: any) {
  return prisma.meeting.findMany({
    where: {
      salesAgentId: agentId,
      ...createdAtFilter,
    },
    select: {
      id: true,
      leadId: true,
      status: true,
      meetingDate: true,
      meetingTime: true,
      createdAt: true,
      lead: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function findSalesAgentProgressDeals(agentId: string, createdAtFilter: any) {
  return prisma.deal.findMany({
    where: {
      salesAgentId: agentId,
      ...createdAtFilter,
    },
    select: {
      id: true,
      totalAmount: true,
      status: true,
      package: true,
      createdAt: true,
      lead: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function findTeleSalesDrillCallLogs(agentIds: string[], createdAtFilter: any) {
  return prisma.callLog.findMany({
    where: { agentId: { in: agentIds }, ...createdAtFilter },
    select: {
      id: true,
      callStatus: true,
      notes: true,
      createdAt: true,
      lead: { select: { name: true, phone: true, classification: true } },
      agent: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function findTeleSalesDrillMeetings(agentIds: string[], whereStatus: any, meetingDateFilter: any) {
  return prisma.meeting.findMany({
    where: { teleAgentId: { in: agentIds }, ...whereStatus, ...meetingDateFilter },
    select: {
      id: true,
      status: true,
      meetingDate: true,
      meetingTime: true,
      createdAt: true,
      lead: { select: { name: true, phone: true } },
      teleAgent: { select: { name: true } },
      salesAgent: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function findTeleSalesDrillDeals(agentIds: string[], createdAtFilter: any, orderBy: any) {
  return prisma.deal.findMany({
    where: { lead: { assignedTeleAgentId: { in: agentIds } }, status: "Closed_Won", ...createdAtFilter },
    select: {
      id: true,
      totalAmount: true,
      status: true,
      package: true,
      createdAt: true,
      lead: { select: { name: true, phone: true, teleAgent: { select: { name: true } } } },
      salesAgent: { select: { name: true } },
    },
    orderBy,
    take: 200,
  });
}

export function findSalesDrillLeads(agentIds: string[], createdAtFilter: any) {
  return prisma.lead.findMany({
    where: { assignedSalesAgentId: { in: agentIds }, ...createdAtFilter },
    select: {
      id: true,
      name: true,
      phone: true,
      classification: true,
      status: true,
      createdAt: true,
      salesAgent: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function findSalesDrillMeetings(agentIds: string[], createdAtFilter: any) {
  return prisma.meeting.findMany({
    where: { salesAgentId: { in: agentIds }, status: { in: ["Attended", "Won"] }, ...createdAtFilter },
    select: {
      id: true,
      status: true,
      meetingDate: true,
      meetingTime: true,
      createdAt: true,
      lead: { select: { name: true, phone: true } },
      salesAgent: { select: { name: true } },
      teleAgent: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function findSalesDrillDeals(agentIds: string[], statusFilter: any, createdAtFilter: any, orderBy: any) {
  return prisma.deal.findMany({
    where: { salesAgentId: { in: agentIds }, status: statusFilter, ...createdAtFilter },
    select: {
      id: true,
      totalAmount: true,
      status: true,
      package: true,
      createdAt: true,
      lead: { select: { name: true, phone: true } },
      salesAgent: { select: { name: true } },
    },
    orderBy,
    take: 200,
  });
}

export function findChiefSalesDeals(dateFilter: any) {
  return prisma.deal.findMany({
    where: dateFilter ? { createdAt: dateFilter } : {},
    include: {
      salesAgent: { select: { name: true } },
      lead: { select: { name: true, niche: true, source: true } },
      installments: { orderBy: { dueDate: "asc" } },
    },
  });
}

export function countChiefSalesLeads(dateFilter: any) {
  return prisma.lead.count({
    where: dateFilter ? { createdAt: dateFilter } : {},
  });
}

export function findChiefSalesMeetings(dateFilter: any) {
  return prisma.meeting.findMany({
    where: dateFilter ? { createdAt: dateFilter } : {},
    include: {
      teleAgent: { select: { name: true } },
    },
  });
}

export function findChiefSalesTeleSalesPerformance(dateFilter: any) {
  return prisma.user.findMany({
    where: { role: { in: ["tele_sales_agent", "tele_sales_manager"] }, status: "Active" },
    select: {
      id: true,
      name: true,
      meetingsAsTele: {
        where: dateFilter ? { createdAt: dateFilter } : {},
        select: { status: true },
      },
    },
  });
}

export function findChiefSalesSalesPerformance(dateFilter: any) {
  return prisma.user.findMany({
    where: { role: { in: ["sales_agent", "sales_manager"] }, status: "Active" },
    select: {
      id: true,
      name: true,
      salesDeals: {
        where: dateFilter ? { createdAt: dateFilter } : {},
        select: { totalAmount: true, status: true, netTarget: true },
      },
    },
  });
}

export function findChiefSalesWarnings() {
  return prisma.warning.findMany({
    where: { status: "Active" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}
