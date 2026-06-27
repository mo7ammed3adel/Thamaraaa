import { prisma } from "@/lib/prisma";

export function createLeaveRequest(input: {
  userId: string;
  type: string;
  date: Date;
  duration: string;
  reason: string;
}) {
  return prisma.leaveRequest.create({
    data: {
      ...input,
      status: "Pending",
    },
  });
}

export function findFirstHrManager() {
  return prisma.user.findFirst({ where: { role: "hr_manager" } });
}

export function createHrNotification(input: {
  userId: string;
  title: string;
  message: string;
  link: string;
}) {
  return prisma.notification.create({ data: input });
}

export function findAllLeaveRequests() {
  return prisma.leaveRequest.findMany({
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export function findLeaveRequestsForUser(userId: string) {
  return prisma.leaveRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export function updateLeaveRequestDecision(input: {
  id: string;
  status: string;
  feedbackNotes?: string | null;
}) {
  return prisma.leaveRequest.update({
    where: { id: input.id },
    data: { status: input.status, feedbackNotes: input.feedbackNotes },
  });
}

export function findEmployeeDocuments(targetUserId?: string | null) {
  return prisma.employeeDocument.findMany({
    where: targetUserId ? { userId: targetUserId } : undefined,
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export function createEmployeeDocument(input: { userId: string; name: string; fileUrl: string }) {
  return prisma.employeeDocument.create({
    data: input,
  });
}

export function deleteEmployeeDocument(id: string) {
  return prisma.employeeDocument.delete({ where: { id } });
}

export function findJobApplicants() {
  return prisma.jobApplicant.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export function createJobApplicant(data: {
  name: string;
  email: string;
  phone: string;
  roleApplied: string;
  notes?: string | null;
}) {
  return prisma.jobApplicant.create({
    data: {
      ...data,
      notes: data.notes || null,
      status: "New",
    },
  });
}

export function updateJobApplicant(id: string, data: any) {
  return prisma.jobApplicant.update({
    where: { id },
    data,
  });
}

export function findHrRecordsForEvaluation() {
  return prisma.hrRecord.findMany({
    include: { user: true },
  });
}

export function updateHrRecord(id: string, data: any) {
  return prisma.hrRecord.update({
    where: { id },
    data,
  });
}
