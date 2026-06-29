import { prisma } from "@/lib/prisma";

export function createManualLeadRecord(input: {
  name: string;
  phone: string;
  storeLink: string | null;
  niche: string | null;
  classification: string;
  assignedTeleAgentId: string | null;
  createdById: string;
  source: string;
  status: string;
  companyId?: string | null;
}) {
  return prisma.lead.create({
    data: input,
    select: {
      id: true,
      name: true,
      phone: true,
      storeLink: true,
      source: true,
      niche: true,
      createdAt: true,
    },
  });
}

export function findUserCompanyId(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
}

export function findLeadAssigneeForManualCreate(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, directManagerId: true },
  });
}

export function findLeadForUpdate(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      teleAgent: { select: { directManagerId: true } },
      salesAgent: { select: { directManagerId: true } },
    },
  });
}

export function findLeadAssigneeForUpdate(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, directManagerId: true },
  });
}

export function updateLeadRecord(id: string, data: any) {
  return prisma.lead.update({
    where: { id },
    data,
  });
}

export function createLeadCallLog(input: {
  leadId: string;
  agentId: string;
  callStatus: string;
  notes: string;
}) {
  return prisma.callLog.create({
    data: input,
  });
}

export function findLatestLeadMeeting(leadId: string) {
  return prisma.meeting.findFirst({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });
}

export function updateLeadMeeting(id: string, data: any) {
  return prisma.meeting.update({
    where: { id },
    data,
  });
}

export function createLeadNotification(input: {
  userId: string;
  title: string;
  message: string;
  link: string;
}) {
  return prisma.notification.create({
    data: input,
  });
}

export function findLeadForDelete(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: { teleAgent: { select: { directManagerId: true } } },
  });
}

export function deleteLeadRecord(id: string) {
  return prisma.lead.delete({
    where: { id },
  });
}

export function findLeadForMeetingDistribution(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      teleAgent: { select: { directManagerId: true } },
      meetings: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, salesAgentId: true },
      },
    },
  });
}

export function findDistributedLead(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      teleAgent: { select: { id: true, name: true } },
      salesAgent: { select: { name: true } },
      callLogs: {
        orderBy: { createdAt: "desc" },
        include: {
          agent: { select: { name: true } },
        },
      },
      meetings: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          teleAgent: { select: { name: true } },
          salesAgent: { select: { name: true } },
        },
      },
    },
  });
}

export function findDraftLeadsForBulk(input: { leadIds: string[]; draftScope: any }) {
  return prisma.lead.findMany({
    where: { id: { in: input.leadIds }, status: "Draft", ...input.draftScope },
    select: { id: true, phone: true },
  });
}

export function findActiveLeadPhones(phones: string[]) {
  return prisma.lead.findMany({
    where: {
      phone: { in: phones },
      status: { not: "Draft" },
    },
    select: { phone: true },
  });
}

export function promoteDraftLeads(input: { leadIds: string[]; assignedTeleAgentId: string }) {
  return prisma.lead.updateMany({
    where: { id: { in: input.leadIds } },
    data: {
      status: "New",
      assignedTeleAgentId: input.assignedTeleAgentId,
    },
  });
}

export function deleteDraftLeads(input: { leadIds: string[]; draftScope: any }) {
  return prisma.lead.deleteMany({
    where: {
      id: { in: input.leadIds },
      status: "Draft",
      ...input.draftScope,
    },
  });
}

export function findExistingLeadPhones() {
  return prisma.lead.findMany({
    select: { phone: true },
  });
}

export function findActiveTeleSalesAgents() {
  return prisma.user.findMany({
    where: { role: "tele_sales_agent", status: "Active" },
    select: { id: true, specialization: true },
  });
}

export function createImportedLead(input: {
  name: string;
  phone: string;
  source: string | null;
  nationality: string | null;
  gender: string | null;
  customerType: string | null;
  storeLink: string | null;
  hasStore: boolean;
  classification: string;
  status: string;
  assignedTeleAgentId: string | null;
  companyId?: string | null;
}) {
  return prisma.lead.create({
    data: input,
  });
}
