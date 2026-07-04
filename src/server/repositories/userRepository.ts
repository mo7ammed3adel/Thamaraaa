import { prisma } from "@/lib/prisma";

/** Shape returned to user-management screens (list + create + edit). */
const USER_MANAGEMENT_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  level: true,
  status: true,
  company: true,
  companyId: true,
  companyRef: { select: { id: true, name: true } },
  directManagerId: true,
  directManager: { select: { id: true, name: true } },
} as const;

export function findUsersForDirectory(where: any) {
  return prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      level: true,
      status: true,
      company: true,
      directManagerId: true,
      directManager: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });
}

export function findUserByEmailOrPhone(email: string, phone?: string | null) {
  const orClauses: Array<Record<string, string>> = [{ email }];
  if (phone) orClauses.push({ phone });
  return prisma.user.findFirst({ where: { OR: orClauses } });
}

/** Active managers of the given role, least-loaded (fewest subordinates) first. */
export function findLeastLoadedManagers(role: string) {
  return prisma.user.findMany({
    where: { role, status: "Active" },
    include: { _count: { select: { subordinates: true } } },
    orderBy: { subordinates: { _count: "asc" } },
  });
}

export function findCompanyById(id: string) {
  return prisma.company.findUnique({ where: { id } });
}

export function createUserWithHrRecord(input: {
  userData: any;
  level: string;
  baseSalary: number;
  monthlyTarget: number;
}) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: input.userData,
      select: { ...USER_MANAGEMENT_SELECT, createdAt: true },
    });

    // Every employee gets an HrRecord that holds the financial/performance fields.
    await tx.hrRecord.create({
      data: {
        userId: created.id,
        baseSalary: input.baseSalary,
        level: input.level,
        monthlyTarget: input.monthlyTarget,
        performanceHistory: "[]",
      },
    });

    return created;
  });
}

export function findUserRoleById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
}

export function updateUserDetails(id: string, data: any) {
  return prisma.user.update({ where: { id }, data, select: USER_MANAGEMENT_SELECT });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

/** Counts of hard business references that must survive a user deletion. */
export function countUserBusinessReferences(id: string) {
  return Promise.all([
    prisma.deal.count({ where: { salesAgentId: id } }),
    prisma.meeting.count({ where: { OR: [{ teleAgentId: id }, { salesAgentId: id }] } }),
    prisma.callLog.count({ where: { agentId: id } }),
    prisma.project.count({
      where: { OR: [{ accountManagerId: id }, { headTechnicalId: id }, { headSeoId: id }] },
    }),
    prisma.warning.count({ where: { senderUserId: id } }),
    prisma.note.count({ where: { userId: id } }),
  ]);
}

export function softDeleteUser(id: string, data: { email: string; phone: string | null }) {
  return prisma.user.update({
    where: { id },
    data: {
      status: "Inactive",
      email: data.email,
      phone: data.phone,
      directManagerId: null,
    },
  });
}

/** Hard delete with cleanup of every dependent record that is safe to remove. */
export function hardDeleteUserCascade(id: string) {
  return prisma.$transaction(async (tx) => {
    // Detach from optional FKs (leads created/assigned, subordinates already cascades to SetNull).
    await tx.lead.updateMany({ where: { assignedTeleAgentId: id }, data: { assignedTeleAgentId: null } });
    await tx.lead.updateMany({ where: { assignedSalesAgentId: id }, data: { assignedSalesAgentId: null } });
    await tx.lead.updateMany({ where: { createdById: id }, data: { createdById: null } });

    // Delete dependent records that are safe to remove with the user.
    await tx.notification.deleteMany({ where: { userId: id } });
    await tx.leaveRequest.deleteMany({ where: { userId: id } });
    await tx.attendance.deleteMany({ where: { userId: id } });
    await tx.employeeDocument.deleteMany({ where: { userId: id } });
    await tx.commission.deleteMany({ where: { userId: id } });
    await tx.agentTarget.deleteMany({ where: { agentId: id } });
    await tx.warningReceipt.deleteMany({ where: { userId: id } });
    await tx.teamAssignment.deleteMany({ where: { OR: [{ userId: id }, { assignedByUserId: id }] } });
    await tx.task.updateMany({ where: { agentId: id }, data: { agentId: null } });
    await tx.task.deleteMany({ where: { leaderId: id } });
    await tx.hrRecord.deleteMany({ where: { userId: id } });

    await tx.user.delete({ where: { id } });
  });
}

export function findUserAuthorityFields(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, directManagerId: true },
  });
}

export function updateUserPresenceStatus(id: string, status: string) {
  return prisma.user.update({
    where: { id },
    data: { status, lastStatusChange: new Date() },
    select: { id: true, name: true, status: true, lastStatusChange: true },
  });
}

export function updateUserSpecialization(id: string, specialization: string | null) {
  return prisma.user.update({
    where: { id },
    data: { specialization },
    select: { id: true, name: true, specialization: true },
  });
}

export function upsertAgentTarget(input: { agentId: string; month: string; target: number }) {
  return prisma.agentTarget.upsert({
    where: { agentId_month: { agentId: input.agentId, month: input.month } },
    update: { target: input.target },
    create: { agentId: input.agentId, month: input.month, target: input.target },
  });
}
