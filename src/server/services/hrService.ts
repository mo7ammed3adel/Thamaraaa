import {
  createHrNotification,
  createEmployeeDocument,
  createLeaveRequest,
  deleteEmployeeDocument,
  findEmployeeDocuments,
  findAllLeaveRequests,
  findFirstHrManager,
  findHrRecordsForEvaluation,
  findJobApplicants,
  findLeaveRequestsForUser,
  createJobApplicant,
  updateLeaveRequestDecision,
  updateJobApplicant,
  updateHrRecord,
  clearEmployeeWarnings,
  createEmployeeWithHrRecord,
  findHrRecordByUserId,
  findEmployeeRole,
  findEmployeesForHrDashboard,
  findUserConflict,
  promoteEmployee,
  terminateEmployee,
  updateEmployeeUser,
  upsertEmployeeHrRecord,
  warnEmployee,
  sumApprovedDeductions,
  aggregateApprovedDeductionsByUser,
  findCommissionForUserMonth,
  findCommissionsByUserForMonth,
  findActiveHrRecordsWithUser,
  createPerformanceReview,
  findPerformanceReviews,
  findOnboardingTasks,
  countOnboardingTasks,
  createOnboardingTasks,
  createOnboardingTask,
  findOnboardingTask,
  setOnboardingTaskDone,
  deleteOnboardingTask,
} from "@/server/repositories/hrRepository";
import { normalizeWebUrl } from "@/lib/safe-url";
import { evaluateAllEmployees } from "@/lib/promotion";
import { computePayslip, currentMonth, monthRange } from "@/lib/payslip";
import { computeLeaveBalance, leaveDaysFromDuration } from "@/lib/leaveBalance";
import bcrypt from "bcryptjs";

const HR_ROLES = ["super_admin", "hr_manager"];
const MONTH_RE = /^\d{4}-\d{2}$/;

function isHrManager(role?: string | null) {
  return role === "hr_manager" || role === "super_admin";
}

function canManageSuperAdmin(actorRole?: string | null) {
  return actorRole === "super_admin";
}

export async function submitLeaveRequest(input: {
  userId: string;
  userName?: string | null;
  body: any;
}) {
  const { type, date, startDate, endDate, duration, reason, attachmentUrl } = input.body;
  const requestType = type || "Leave";
  const requestDate = parseDateOrNull(date || startDate) || new Date();
  const days = Number(input.body.days) || leaveDaysFromDuration(duration);

  const record = await findHrRecordByUserId(input.userId);
  const hiringDate = record?.hiringDate;
  if ((requestType === "Leave" || requestType === "annual") && hiringDate) {
    const serviceDays = Math.floor((Date.now() - hiringDate.getTime()) / 86400000);
    if (serviceDays < 90) {
      return { status: "not_eligible" as const };
    }
    const requests = await findLeaveRequestsForUser(input.userId);
    const balance = computeLeaveBalance(requests, requestDate.getFullYear(), 21);
    if (days > balance.remaining) {
      return { status: "insufficient_balance" as const, balance };
    }
  }

  if (requestType === "Permission") {
    const hours = hoursFromDuration(duration);
    if (hours > 6) return { status: "permission_limit" as const };
    const requests = await findLeaveRequestsForUser(input.userId);
    const monthHours = requests
      .filter(
        (req) =>
          req.type === "Permission" &&
          req.status !== "Rejected" &&
          req.date.getFullYear() === requestDate.getFullYear() &&
          req.date.getMonth() === requestDate.getMonth()
      )
      .reduce((sum, req) => sum + hoursFromDuration(req.duration), 0);
    if (monthHours + hours > 6) return { status: "permission_limit" as const };
  }

  const request = await createLeaveRequest({
    userId: input.userId,
    type: requestType,
    date: requestDate,
    startDate: parseDateOrNull(startDate) || requestDate,
    endDate: parseDateOrNull(endDate) || parseDateOrNull(startDate) || requestDate,
    days,
    duration,
    reason,
    attachmentUrl: attachmentUrl ? normalizeWebUrl(attachmentUrl) : null,
  });

  const hr = await findFirstHrManager();
  if (hr) {
    await createHrNotification({
      userId: hr.id,
      title: `New ${requestType} Request`,
      message: `${input.userName} has requested a ${requestType} for ${requestDate.toLocaleDateString()}`,
      link: `/dashboard/hr/requests`,
    });
  }

  return { status: "ok" as const, request };
}

function hoursFromDuration(duration?: string | null) {
  const match = String(duration || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) || 0 : 0;
}

export function listEmployees() {
  return findEmployeesForHrDashboard();
}

export async function createEmployee(input: { actorRole?: string | null; body: any }) {
  if (!isHrManager(input.actorRole)) {
    return { status: "unauthorized" as const };
  }

  const data = input.body;
  if (!data.name || !data.email || !data.password || !data.role) {
    return { status: "missing_fields" as const };
  }

  if (data.role === "super_admin" && !canManageSuperAdmin(input.actorRole)) {
    return { status: "super_admin_create_forbidden" as const };
  }

  const existing = await findUserConflict({ email: data.email, phone: data.phone });
  if (existing) {
    const conflict = existing.email === data.email ? "email" : "phone";
    return { status: "conflict" as const, conflict };
  }

  const level = data.level || "Junior";
  const user = await createEmployeeWithHrRecord({
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    passwordHash: await bcrypt.hash(data.password, 10),
    role: data.role,
    level,
    company: data.company || null,
    status: data.status || "Active",
    directManagerId: data.directManagerId || null,
    baseSalary: Number(data.baseSalary) || 0,
    monthlyTarget: Number(data.monthlyTarget) || 0,
    personalEmail: data.personalEmail || null,
    nationalId: data.nationalId || null,
    dateOfBirth: parseDateOrNull(data.dateOfBirth),
    gender: data.gender || null,
    address: data.address || null,
    department: data.department || null,
    jobTitle: data.jobTitle || null,
    hiringDate: parseDateOrNull(data.hiringDate),
    employmentType: data.employmentType || "full-time",
    workMode: data.workMode || "onsite",
    employmentStatus: data.employmentStatus || "active",
    startingSalary: Number(data.startingSalary ?? data.baseSalary) || 0,
    currentSalary: Number(data.currentSalary ?? data.baseSalary) || 0,
    documentChecklist: JSON.stringify(normalizeDocumentChecklist(data.documentChecklist)),
    fingerprintCode: data.fingerprintCode || null,
    allowances: Number(data.allowances) || 0,
    workingHoursPerDay: Number(data.workingHoursPerDay) || 8,
    bankAccount: data.bankAccount || null,
  });

  return { status: "ok" as const, user };
}

export async function updateEmployee(input: { actorRole?: string | null; body: any }) {
  if (!isHrManager(input.actorRole)) {
    return { status: "unauthorized" as const };
  }

  const data = input.body;
  if (!data.id) {
    return { status: "missing_id" as const };
  }

  const target = await findEmployeeRole(data.id);
  if (!target) {
    return { status: "not_found" as const };
  }

  if (!canManageSuperAdmin(input.actorRole) && target.role === "super_admin") {
    return { status: "super_admin_edit_forbidden" as const };
  }

  if (!canManageSuperAdmin(input.actorRole) && data.role === "super_admin") {
    return { status: "super_admin_grant_forbidden" as const };
  }

  const userData: any = {};
  if (data.name !== undefined) userData.name = data.name;
  if (data.role !== undefined) userData.role = data.role;
  if (data.phone !== undefined) userData.phone = data.phone || null;
  if (data.status !== undefined) userData.status = data.status;
  if (data.level !== undefined) userData.level = data.level;
  if (data.company !== undefined) userData.company = data.company || null;
  if (data.directManagerId !== undefined) userData.directManagerId = data.directManagerId || null;

  const updated = await updateEmployeeUser({ id: data.id, data: userData });

  const hrData: any = {};
  if (data.baseSalary !== undefined) hrData.baseSalary = Number(data.baseSalary) || 0;
  if (data.monthlyTarget !== undefined) hrData.monthlyTarget = Number(data.monthlyTarget) || 0;
  if (data.level !== undefined) hrData.level = data.level;
  if (data.personalEmail !== undefined) hrData.personalEmail = data.personalEmail || null;
  if (data.nationalId !== undefined) hrData.nationalId = data.nationalId || null;
  if (data.dateOfBirth !== undefined) hrData.dateOfBirth = parseDateOrNull(data.dateOfBirth);
  if (data.gender !== undefined) hrData.gender = data.gender || null;
  if (data.address !== undefined) hrData.address = data.address || null;
  if (data.department !== undefined) hrData.department = data.department || null;
  if (data.jobTitle !== undefined) hrData.jobTitle = data.jobTitle || null;
  if (data.hiringDate !== undefined) hrData.hiringDate = parseDateOrNull(data.hiringDate);
  if (data.employmentType !== undefined) hrData.employmentType = data.employmentType || null;
  if (data.employmentStatus !== undefined) hrData.employmentStatus = data.employmentStatus || "active";
  if (data.resignationDate !== undefined) hrData.resignationDate = parseDateOrNull(data.resignationDate);
  if (data.startingSalary !== undefined) hrData.startingSalary = Number(data.startingSalary) || 0;
  if (data.currentSalary !== undefined) hrData.currentSalary = Number(data.currentSalary) || 0;
  if (data.documentChecklist !== undefined) {
    hrData.documentChecklist = JSON.stringify(normalizeDocumentChecklist(data.documentChecklist));
  }
  if (data.fingerprintCode !== undefined) hrData.fingerprintCode = data.fingerprintCode || null;
  if (data.allowances !== undefined) hrData.allowances = Number(data.allowances) || 0;
  if (data.workingHoursPerDay !== undefined) hrData.workingHoursPerDay = Number(data.workingHoursPerDay) || 8;
  if (data.bankAccount !== undefined) hrData.bankAccount = data.bankAccount || null;

  if (Object.keys(hrData).length > 0) {
    await upsertEmployeeHrRecord({
      userId: data.id,
      data: hrData,
      fallbackLevel: updated.level,
    });
  }

  return { status: "ok" as const, user: updated };
}

function parseDateOrNull(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDocumentChecklist(value: unknown) {
  const defaults = {
    nationalId: false,
    resume: false,
    employmentContract: false,
    graduationCertificate: false,
    militaryDocument: false,
    socialInsurance: false,
    otherDocuments: false,
  };
  if (!value) return defaults;
  if (typeof value === "string") {
    try {
      return { ...defaults, ...JSON.parse(value) };
    } catch {
      return defaults;
    }
  }
  if (typeof value === "object") {
    return { ...defaults, ...(value as Record<string, boolean>) };
  }
  return defaults;
}

export function listLeaveRequests(input: { userId: string; userRole?: string | null }) {
  if (input.userRole === "hr_manager" || input.userRole === "super_admin") {
    return findAllLeaveRequests();
  }

  return findLeaveRequestsForUser(input.userId);
}

export async function decideLeaveRequest(input: {
  id: string;
  status: string;
  feedbackNotes?: string | null;
}) {
  const leaveRequest = await updateLeaveRequestDecision(input);

  await createHrNotification({
    userId: leaveRequest.userId,
    title: `Request ${input.status}`,
    message: `Your ${leaveRequest.type} request for ${leaveRequest.date.toLocaleDateString()} has been ${input.status}.`,
    link: `/dashboard/profile`,
  });

  return leaveRequest;
}

export async function listEmployeeDocuments(input: {
  sessionUserId: string;
  sessionUserRole?: string | null;
  userIdParam?: string | null;
}) {
  const isHr = HR_ROLES.includes(input.sessionUserRole || "");
  const targetUserId = input.userIdParam || input.sessionUserId;
  if (!isHr && targetUserId !== input.sessionUserId) {
    return { status: "forbidden" as const };
  }

  const documents = await findEmployeeDocuments(targetUserId);
  return { status: "ok" as const, documents };
}

export async function uploadEmployeeDocument(input: {
  sessionUserId: string;
  sessionUserRole?: string | null;
  body: any;
}) {
  const { userId, name, fileUrl } = input.body || {};
  const safeFileUrl = normalizeWebUrl(fileUrl);
  const safeName = typeof name === "string" ? name.trim().slice(0, 120) : "";
  if (!safeName || !safeFileUrl) {
    return { status: "missing_fields" as const };
  }

  const isHr = HR_ROLES.includes(input.sessionUserRole || "");
  const targetUserId = userId || input.sessionUserId;
  if (!isHr && targetUserId !== input.sessionUserId) {
    return { status: "upload_forbidden" as const };
  }

  const document = await createEmployeeDocument({
    userId: targetUserId,
    name: safeName,
    fileUrl: safeFileUrl,
  });

  return { status: "ok" as const, document };
}

export async function removeEmployeeDocument(id: string) {
  await deleteEmployeeDocument(id);
  return { success: true };
}

export function listJobApplicants() {
  return findJobApplicants();
}

export function addJobApplicant(body: any) {
  return createJobApplicant({
    name: body.name,
    email: body.email,
    phone: body.phone,
    roleApplied: body.roleApplied,
    notes: body.notes || null,
  });
}

export function editJobApplicant(id: string, body: any) {
  const updateData: any = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes;

  return updateJobApplicant(id, updateData);
}

export async function evaluateHrRecords() {
  const records = await findHrRecordsForEvaluation();

  let promotions = 0;
  let warnings = 0;

  for (const record of records) {
    let history: { month: string; hitTarget: boolean }[] = [];
    try {
      history = JSON.parse(record.performanceHistory || "[]");
    } catch (e) {
      continue;
    }

    if (history.length < 3) continue;

    const last3 = history.slice(-3);
    const consecutiveHits = last3.every((item) => item.hitTarget === true);
    const consecutiveMisses = last3.every((item) => item.hitTarget === false);

    const updates: any = {};

    if (consecutiveHits && !record.promotionEligible) {
      updates.promotionEligible = true;
      promotions++;
    } else if (consecutiveMisses) {
      updates.warningCount = record.warningCount + 1;
      if (updates.warningCount >= 3) {
        updates.terminationFlag = true;
      }
      warnings++;
    }

    if (Object.keys(updates).length > 0) {
      await updateHrRecord(record.id, updates);
    }
  }

  return {
    success: true,
    message: `Evaluation complete. ${promotions} new promotions eligible, ${warnings} new warnings issued.`,
  };
}

export function listPromotionEvaluations() {
  return evaluateAllEmployees();
}

export async function getPayslip(input: {
  sessionUserId: string;
  sessionUserRole?: string | null;
  targetUserId?: string | null;
  month?: string | null;
}) {
  const isHr = HR_ROLES.includes(input.sessionUserRole || "");
  const targetUserId = input.targetUserId || input.sessionUserId;
  if (!isHr && targetUserId !== input.sessionUserId) {
    return { status: "forbidden" as const };
  }

  const month = input.month && MONTH_RE.test(input.month) ? input.month : currentMonth();

  const record = await findHrRecordByUserId(targetUserId);
  if (!record) {
    return { status: "no_record" as const, month };
  }

  const { start, end } = monthRange(month);
  const deductions = await sumApprovedDeductions(targetUserId, start, end);
  const commission = await findCommissionForUserMonth(targetUserId, month);

  const payslip = computePayslip({
    baseSalary: record.baseSalary,
    bonuses: commission?.commissionAmount || 0,
    deductions,
  });

  return {
    status: "ok" as const,
    month,
    employee: { id: record.user.id, name: record.user.name, role: record.user.role },
    payslip,
  };
}

// ── Performance reviews ──
export async function createReview(input: {
  reviewerId: string;
  reviewerRole?: string | null;
  body: any;
}) {
  if (!isHrManager(input.reviewerRole)) {
    return { status: "unauthorized" as const };
  }

  const { userId, period, rating, strengths, improvements, goals } = input.body || {};
  const ratingNum = Number(rating);
  if (!userId || !period || !ratingNum || ratingNum < 1 || ratingNum > 5) {
    return { status: "missing_fields" as const };
  }

  const review = await createPerformanceReview({
    userId,
    reviewerId: input.reviewerId,
    period: String(period).slice(0, 20),
    rating: ratingNum,
    strengths: strengths?.trim() || null,
    improvements: improvements?.trim() || null,
    goals: goals?.trim() || null,
  });

  await createHrNotification({
    userId,
    title: "New Performance Review",
    message: "Your performance review has been recorded by HR.",
    link: "/dashboard/hr",
  });

  return { status: "ok" as const, review };
}

export function listReviews(input: {
  sessionUserId: string;
  sessionUserRole?: string | null;
  targetUserId?: string | null;
}) {
  const isHr = HR_ROLES.includes(input.sessionUserRole || "");
  if (isHr) {
    return findPerformanceReviews(input.targetUserId || undefined);
  }
  return findPerformanceReviews(input.sessionUserId);
}

// ── Onboarding / offboarding ──
const ONBOARDING_TEMPLATE = [
  "Sign employment contract",
  "Collect ID & personal documents",
  "Set up email & system accounts",
  "Assign equipment / workspace",
  "Introduce to team & manager",
  "First-week orientation & training",
];

const OFFBOARDING_TEMPLATE = [
  "Revoke all system access",
  "Return company equipment",
  "Knowledge handover & documentation",
  "Final settlement & payslip",
  "Conduct exit interview",
];

export function listOnboarding(input: {
  sessionUserId: string;
  sessionUserRole?: string | null;
  targetUserId?: string | null;
}) {
  const isHr = HR_ROLES.includes(input.sessionUserRole || "");
  const targetUserId = isHr ? input.targetUserId || input.sessionUserId : input.sessionUserId;
  return findOnboardingTasks(targetUserId);
}

export async function manageOnboarding(input: {
  sessionUserRole?: string | null;
  body: any;
}) {
  if (!isHrManager(input.sessionUserRole)) {
    return { status: "unauthorized" as const };
  }

  const { action, userId, kind, title } = input.body || {};
  const safeKind = kind === "offboarding" ? "offboarding" : "onboarding";

  if (action === "seed") {
    if (!userId) return { status: "missing_fields" as const };
    const existing = await countOnboardingTasks(userId, safeKind);
    if (existing > 0) {
      return { status: "already_seeded" as const };
    }
    const template = safeKind === "offboarding" ? OFFBOARDING_TEMPLATE : ONBOARDING_TEMPLATE;
    await createOnboardingTasks(
      template.map((t, index) => ({ userId, kind: safeKind, title: t, orderIndex: index }))
    );
    return { status: "ok" as const };
  }

  if (action === "add") {
    const cleanTitle = typeof title === "string" ? title.trim().slice(0, 160) : "";
    if (!userId || !cleanTitle) return { status: "missing_fields" as const };
    const count = await countOnboardingTasks(userId, safeKind);
    await createOnboardingTask({ userId, kind: safeKind, title: cleanTitle, orderIndex: count });
    return { status: "ok" as const };
  }

  return { status: "invalid_action" as const };
}

export async function toggleOnboarding(input: {
  sessionUserRole?: string | null;
  body: any;
}) {
  if (!isHrManager(input.sessionUserRole)) {
    return { status: "unauthorized" as const };
  }
  const { id, completed } = input.body || {};
  if (!id) return { status: "missing_fields" as const };

  const task = await findOnboardingTask(id);
  if (!task) return { status: "not_found" as const };

  await setOnboardingTaskDone(id, Boolean(completed));
  return { status: "ok" as const };
}

export async function removeOnboarding(input: {
  sessionUserRole?: string | null;
  id?: string | null;
}) {
  if (!isHrManager(input.sessionUserRole)) {
    return { status: "unauthorized" as const };
  }
  if (!input.id) return { status: "missing_fields" as const };
  await deleteOnboardingTask(input.id);
  return { status: "ok" as const };
}

export async function listPayroll(input: { month?: string | null }) {
  const month = input.month && MONTH_RE.test(input.month) ? input.month : currentMonth();
  const { start, end } = monthRange(month);

  const [records, deductionsByUser, commissionsByUser] = await Promise.all([
    findActiveHrRecordsWithUser(),
    aggregateApprovedDeductionsByUser(start, end),
    findCommissionsByUserForMonth(month),
  ]);

  const rows = records.map((record) => {
    const payslip = computePayslip({
      baseSalary: record.baseSalary,
      bonuses: commissionsByUser.get(record.userId) || 0,
      deductions: deductionsByUser.get(record.userId) || 0,
    });
    return {
      userId: record.userId,
      name: record.user.name,
      role: record.user.role,
      status: record.user.status,
      ...payslip,
    };
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));

  const totals = rows.reduce(
    (acc, row) => ({
      baseSalary: acc.baseSalary + row.baseSalary,
      bonuses: acc.bonuses + row.bonuses,
      deductions: acc.deductions + row.deductions,
      net: acc.net + row.net,
    }),
    { baseSalary: 0, bonuses: 0, deductions: 0, net: 0 }
  );

  return { month, rows, totals };
}

export async function applyPromotionAction(input: {
  userId?: string;
  action?: string;
  nextLevel?: string;
  nextRole?: string;
}) {
  if (!input.userId || !input.action) {
    return { status: "missing_fields" as const };
  }

  const validActions = ["promote", "warn", "terminate", "clear"] as const;
  if (!validActions.includes(input.action as any)) {
    return { status: "invalid_action" as const, action: input.action };
  }

  const hr = await findHrRecordByUserId(input.userId);
  if (!hr) {
    return { status: "hr_not_found" as const };
  }

  if (input.action === "promote") {
    const userUpdate: { level?: string; role?: string } = {};
    if (input.nextLevel) userUpdate.level = input.nextLevel;
    if (input.nextRole) userUpdate.role = input.nextRole;
    if (Object.keys(userUpdate).length === 0) {
      return { status: "promote_missing_fields" as const };
    }

    await promoteEmployee({
      userId: input.userId,
      userUpdate,
      hrLevel: input.nextLevel || hr.level,
    });

    return { status: "ok" as const, action: input.action, userId: input.userId };
  }

  if (input.action === "warn") {
    const warningCount = hr.warningCount + 1;
    const terminationFlag = warningCount >= 3;
    await warnEmployee({ userId: input.userId, warningCount, terminationFlag });
    return { status: "warned" as const, action: input.action, userId: input.userId, warningCount, terminationFlag };
  }

  if (input.action === "terminate") {
    await terminateEmployee(input.userId);
    return { status: "ok" as const, action: input.action, userId: input.userId };
  }

  if (input.action === "clear") {
    await clearEmployeeWarnings(input.userId);
    return { status: "ok" as const, action: input.action, userId: input.userId };
  }

  return { status: "unhandled" as const };
}
