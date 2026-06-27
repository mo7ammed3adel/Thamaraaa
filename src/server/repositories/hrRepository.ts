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
