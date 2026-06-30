import { prisma } from "@/lib/prisma";

type CreateEmployeeInput = {
  name: string;
  email: string;
  phone?: string | null;
  passwordHash: string;
  role: string;
  level: string;
  company?: string | null;
  status: string;
  directManagerId?: string | null;
  baseSalary: number;
  monthlyTarget: number;
  personalEmail?: string | null;
  nationalId?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  address?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  hiringDate?: Date | null;
  employmentType?: string | null;
  workMode?: string | null;
  employmentStatus?: string | null;
  startingSalary?: number | null;
  currentSalary?: number | null;
  documentChecklist?: string | null;
  fingerprintCode?: string | null;
  allowances?: number;
  workingHoursPerDay?: number;
  bankAccount?: string | null;
};

export function createLeaveRequest(input: {
  userId: string;
  type: string;
  date: Date;
  duration: string;
  reason: string;
  startDate?: Date | null;
  endDate?: Date | null;
  days?: number | null;
  attachmentUrl?: string | null;
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

export function findHrRecordByUserId(userId: string) {
  return prisma.hrRecord.findUnique({
    where: { userId },
    include: { user: { select: { id: true, name: true, role: true, level: true } } },
  });
}

/** Look up a department by its (unique) name to read its policy JSON. */
export function findDepartmentByName(name: string) {
  return prisma.hrDepartment.findUnique({ where: { name }, select: { policy: true } });
}

export function promoteEmployee(input: { userId: string; userUpdate: any; hrLevel: string }) {
  return prisma.$transaction([
    prisma.user.update({ where: { id: input.userId }, data: input.userUpdate }),
    prisma.hrRecord.update({
      where: { userId: input.userId },
      data: { promotionEligible: false, level: input.hrLevel },
    }),
    prisma.notification.create({
      data: {
        userId: input.userId,
        title: "Promotion",
        message: `Congratulations! You have been promoted${
          input.userUpdate.level ? ` to ${input.userUpdate.level}` : ""
        }${input.userUpdate.role ? ` (${input.userUpdate.role.replace(/_/g, " ")})` : ""}.`,
        type: "promotion",
      },
    }),
  ]);
}

export function warnEmployee(input: { userId: string; warningCount: number; terminationFlag: boolean }) {
  return prisma.$transaction([
    prisma.hrRecord.update({
      where: { userId: input.userId },
      data: { warningCount: input.warningCount, terminationFlag: input.terminationFlag },
    }),
    prisma.notification.create({
      data: {
        userId: input.userId,
        title: "Performance Warning",
        message: `You have received a performance warning (count: ${input.warningCount}). Please discuss with HR.`,
        type: "hr_warning",
      },
    }),
  ]);
}

export function terminateEmployee(userId: string) {
  return prisma.$transaction([
    prisma.hrRecord.update({ where: { userId }, data: { terminationFlag: true } }),
    prisma.user.update({ where: { id: userId }, data: { status: "Inactive" } }),
    prisma.notification.create({
      data: {
        userId,
        title: "Account Inactive",
        message: "Your account has been marked inactive. Contact HR for details.",
        type: "hr_termination",
      },
    }),
  ]);
}

export function clearEmployeeWarnings(userId: string) {
  return prisma.hrRecord.update({
    where: { userId },
    data: { warningCount: 0, terminationFlag: false, promotionEligible: false },
  });
}

export function findEmployeesForHrDashboard() {
  return prisma.user.findMany({
    include: {
      hrRecord: true,
      attendances: {
        take: 5,
        orderBy: { date: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function findUserConflict(input: { email: string; phone?: string | null }) {
  const orClauses: Array<Record<string, string>> = [{ email: input.email }];
  if (input.phone) orClauses.push({ phone: input.phone });
  return prisma.user.findFirst({ where: { OR: orClauses } });
}

export function createEmployeeWithHrRecord(input: CreateEmployeeInput) {
  return prisma.$transaction(async (tx) => {
    const employeeCode = await nextEmployeeCode(tx);
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        passwordHash: input.passwordHash,
        role: input.role,
        level: input.level,
        company: input.company || null,
        status: input.status,
        directManagerId: input.directManagerId || null,
        mustChangePassword: true, // new hire must set their own password on first login
      },
      select: { id: true, name: true, email: true, role: true, level: true, status: true },
    });

    await tx.hrRecord.create({
      data: {
        userId: created.id,
        baseSalary: input.baseSalary,
        level: input.level,
        monthlyTarget: input.monthlyTarget,
        performanceHistory: "[]",
        employeeCode,
        personalEmail: input.personalEmail || null,
        nationalId: input.nationalId || null,
        dateOfBirth: input.dateOfBirth || null,
        gender: input.gender || null,
        address: input.address || null,
        department: input.department || null,
        jobTitle: input.jobTitle || null,
        hiringDate: input.hiringDate || new Date(),
        employmentType: input.employmentType || "full-time",
        workMode: input.workMode || "onsite",
        employmentStatus: input.employmentStatus || "active",
        startingSalary: input.startingSalary ?? input.baseSalary,
        currentSalary: input.currentSalary ?? input.baseSalary,
        documentChecklist: input.documentChecklist || "{}",
        fingerprintCode: input.fingerprintCode || null,
        allowances: input.allowances || 0,
        workingHoursPerDay: input.workingHoursPerDay || 8,
        bankAccount: input.bankAccount || null,
      },
    });

    await tx.salaryHistory.create({
      data: {
        userId: created.id,
        effectiveDate: input.hiringDate || new Date(),
        previousSalary: 0,
        newSalary: input.currentSalary ?? input.baseSalary,
        increaseAmount: input.currentSalary ?? input.baseSalary,
        increasePct: 0,
        changeType: "hire",
        reviewStatus: "completed",
      },
    });

    await tx.employeeFolder.createMany({
      data: ["Contracts", "Identity", "Payroll", "Reviews", "Assets"].map((name) => ({
        userId: created.id,
        name,
      })),
      skipDuplicates: true,
    });

    await tx.notification.create({
      data: {
        userId: created.id,
        title: "Welcome to Thamara",
        message: "Your account has been created. You can now sign in.",
        link: "/dashboard",
      },
    });

    return { ...created, employeeCode };
  });
}

async function nextEmployeeCode(tx: any) {
  const count = await tx.hrRecord.count();
  for (let offset = 1; offset < 10000; offset++) {
    const code = `VRL-${String(count + offset).padStart(4, "0")}`;
    const exists = await tx.hrRecord.findUnique({ where: { employeeCode: code } });
    if (!exists) return code;
  }
  return `VRL-${Date.now().toString().slice(-4)}`;
}

export async function sumApprovedDeductions(userId: string, start: Date, end: Date) {
  const result = await prisma.attendance.aggregate({
    where: { userId, deductionApproved: true, date: { gte: start, lt: end } },
    _sum: { deductionDraft: true },
  });
  return result._sum.deductionDraft || 0;
}

export async function aggregateApprovedDeductionsByUser(start: Date, end: Date) {
  const rows = await prisma.attendance.groupBy({
    by: ["userId"],
    where: { deductionApproved: true, date: { gte: start, lt: end } },
    _sum: { deductionDraft: true },
  });
  return new Map(rows.map((row) => [row.userId, row._sum.deductionDraft || 0]));
}

export function findCommissionForUserMonth(userId: string, month: string) {
  return prisma.commission.findFirst({ where: { userId, month } });
}

export async function findCommissionsByUserForMonth(month: string) {
  const rows = await prisma.commission.findMany({ where: { month } });
  return new Map(rows.map((row) => [row.userId, row.commissionAmount || 0]));
}

export function findActiveHrRecordsWithUser() {
  return prisma.hrRecord.findMany({
    include: { user: { select: { id: true, name: true, role: true, status: true } } },
  });
}

export function findEmployeeRole(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
}

// ── Performance reviews ──
export function createPerformanceReview(input: {
  userId: string;
  reviewerId: string;
  period: string;
  rating: number;
  strengths?: string | null;
  improvements?: string | null;
  goals?: string | null;
}) {
  return prisma.performanceReview.create({ data: input });
}

export function findPerformanceReviews(userId?: string | null) {
  return prisma.performanceReview.findMany({
    where: userId ? { userId } : undefined,
    include: {
      user: { select: { id: true, name: true, role: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── Onboarding / offboarding checklist ──
export function findOnboardingTasks(userId: string) {
  return prisma.onboardingTask.findMany({
    where: { userId },
    orderBy: [{ kind: "asc" }, { orderIndex: "asc" }],
  });
}

export function countOnboardingTasks(userId: string, kind: string) {
  return prisma.onboardingTask.count({ where: { userId, kind } });
}

export function createOnboardingTasks(
  rows: { userId: string; kind: string; title: string; orderIndex: number }[]
) {
  return prisma.onboardingTask.createMany({ data: rows });
}

export function createOnboardingTask(input: {
  userId: string;
  kind: string;
  title: string;
  orderIndex: number;
}) {
  return prisma.onboardingTask.create({ data: input });
}

export function findOnboardingTask(id: string) {
  return prisma.onboardingTask.findUnique({ where: { id }, select: { id: true, userId: true } });
}

export function setOnboardingTaskDone(id: string, completed: boolean) {
  return prisma.onboardingTask.update({
    where: { id },
    data: { completed, completedAt: completed ? new Date() : null },
  });
}

export function deleteOnboardingTask(id: string) {
  return prisma.onboardingTask.delete({ where: { id } });
}

export function updateEmployeeUser(input: { id: string; data: any }) {
  return prisma.user.update({
    where: { id: input.id },
    data: input.data,
    select: { id: true, name: true, role: true, status: true, level: true },
  });
}

export function upsertEmployeeHrRecord(input: {
  userId: string;
  data: any;
  fallbackLevel?: string | null;
}) {
  return prisma.hrRecord.upsert({
    where: { userId: input.userId },
    update: input.data,
    create: {
      userId: input.userId,
      baseSalary: input.data.baseSalary || 0,
      level: input.data.level || input.fallbackLevel || "Junior",
      monthlyTarget: input.data.monthlyTarget || 0,
      performanceHistory: "[]",
    },
  });
}
