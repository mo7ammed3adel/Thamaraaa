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
