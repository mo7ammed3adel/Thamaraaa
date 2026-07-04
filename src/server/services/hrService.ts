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
  findDepartmentByName,
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
  findActiveHrRequestTypes,
  findHrRequestsScoped,
  findUserNamesByIds,
  findActiveHrManagerId,
  findHrComplaintsScoped,
  createHrComplaint,
  updateHrComplaint,
  createHrComplaintNote,
  findHrComplaintWithNotes,
  findHrDepartmentsWithDocuments,
  findHrRecordDepartments,
  findHrDepartmentByExactName,
  findHrDepartmentNameConflict,
  createHrDepartment,
  updateHrDepartment,
  findHrDepartmentById,
  countHrRecordsInDepartment,
  deleteHrDepartment,
  createDepartmentDocument,
  deleteDepartmentDocument,
  findSalaryAdvancesScoped,
  createSalaryAdvanceRequest,
  findSalaryAdvanceById,
  updateSalaryAdvanceById,
  findAttendanceSince,
  createAttendanceRecord,
  updateAttendanceRecord,
  findHrRecordSalaryFields,
} from "@/server/repositories/hrRepository";
import { parseJsonOr, stringifyJson } from "@/server/parsers/json";
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

/** Parse a department policy JSON string defensively (never throws). */
function safeParsePolicy(raw?: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
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
    // Probation window comes from the employee's department policy
    // (probationMonths), falling back to the standard 3 months.
    let probationMonths = 3;
    if (record?.department) {
      const dept = await findDepartmentByName(record.department);
      const policy = safeParsePolicy(dept?.policy);
      const pm = Number(policy?.probationMonths);
      if (Number.isFinite(pm) && pm >= 0) probationMonths = pm;
    }
    const serviceDays = Math.floor((Date.now() - hiringDate.getTime()) / 86400000);
    if (serviceDays < probationMonths * 30) {
      return { status: "not_eligible" as const, probationMonths };
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

// ── HR self-service: central requests, complaints, departments, salary advances ──

type SessionUser = { id: string; role?: string | null; name?: string | null };

const COMPLAINT_VISIBILITY = ["hr_only", "dept_head", "team_leader", "everyone"];
const COMPLAINT_STATUSES = ["open", "in_progress", "resolved", "closed"];
const SALARY_ADVANCE_ROLES = ["super_admin", "hr_manager", "accountant"];

/** HR sees every central request; an employee sees only their own. */
export async function listCentralHrRequests(user: SessionUser) {
  const isHr = HR_ROLES.includes(user.role || "");
  const [requestTypes, requests] = await Promise.all([
    findActiveHrRequestTypes(),
    findHrRequestsScoped(isHr ? null : user.id),
  ]);
  return { requestTypes, requests };
}

export async function listComplaints(user: SessionUser) {
  const isHr = HR_ROLES.includes(user.role || "");
  const complaints = await findHrComplaintsScoped(isHr ? null : user.id);
  const names = new Map(
    (await findUserNamesByIds(complaints.map((c) => c.userId))).map((u) => [u.id, u.name])
  );
  return complaints.map((c) => ({ ...c, employeeName: names.get(c.userId) || "Unknown" }));
}

export async function submitComplaint(input: { user: SessionUser; body: any }) {
  const { user, body } = input;
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const details = typeof body?.details === "string" ? body.details.trim() : "";
  const visibility = COMPLAINT_VISIBILITY.includes(body?.visibility) ? body.visibility : "hr_only";
  const attachmentUrl = body?.attachmentUrl ? normalizeWebUrl(body.attachmentUrl) : null;
  if (!subject || !details) return { status: "missing_fields" as const };

  const complaint = await createHrComplaint({
    userId: user.id,
    subject: subject.slice(0, 160),
    details,
    visibility,
    attachmentUrl,
  });
  const hr = await findActiveHrManagerId();
  if (hr) {
    await createHrNotification({
      userId: hr.id,
      title: "New Complaint",
      message: `${user.name} submitted a complaint: ${subject.slice(0, 60)}`,
      link: "/dashboard/hr",
    });
  }
  return { status: "ok" as const, complaint };
}

export async function reviewComplaint(input: { user: SessionUser; id: string; body: any }) {
  const { user, id, body } = input;
  if (!HR_ROLES.includes(user.role || "")) return { status: "forbidden" as const };

  const data: any = {};
  if (body?.status) {
    if (!COMPLAINT_STATUSES.includes(body.status)) return { status: "invalid_status" as const };
    data.status = body.status;
  }
  if (Object.keys(data).length > 0) {
    await updateHrComplaint(id, data);
  }
  if (typeof body?.note === "string" && body.note.trim()) {
    await createHrComplaintNote({ complaintId: id, authorId: user.id, note: body.note.trim() });
  }
  const complaint = await findHrComplaintWithNotes(id);
  return { status: "ok" as const, complaint };
}

export async function listHrDepartments(user: SessionUser) {
  if (!HR_ROLES.includes(user.role || "")) return { status: "forbidden" as const };

  const [departments, hrRecords] = await Promise.all([
    findHrDepartmentsWithDocuments(),
    findHrRecordDepartments(),
  ]);
  const counts = new Map<string, number>();
  for (const r of hrRecords) {
    if (r.department) counts.set(r.department, (counts.get(r.department) || 0) + 1);
  }
  return {
    status: "ok" as const,
    departments: departments.map((d) => ({
      ...d,
      teamLeaderIds: parseJsonOr(d.teamLeaderIds, []),
      policy: parseJsonOr(d.policy, {}),
      employeeCount: counts.get(d.name) || 0,
    })),
  };
}

export async function createDepartment(input: { user: SessionUser; body: any }) {
  const { user, body } = input;
  if (!HR_ROLES.includes(user.role || "")) return { status: "forbidden" as const };

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return { status: "missing_name" as const };

  const existing = await findHrDepartmentByExactName(name);
  if (existing) return { status: "duplicate_name" as const };

  const department = await createHrDepartment({
    name,
    description: body.description || null,
    status: body.status === "inactive" ? "inactive" : "active",
    headId: body.headId || null,
    teamLeaderIds: stringifyJson(Array.isArray(body.teamLeaderIds) ? body.teamLeaderIds : []),
    policy: stringifyJson(body.policy && typeof body.policy === "object" ? body.policy : {}),
  });
  return { status: "ok" as const, department };
}

export async function editDepartment(input: { user: SessionUser; id: string; body: any }) {
  const { user, id, body } = input;
  if (!HR_ROLES.includes(user.role || "")) return { status: "forbidden" as const };
  if (!body) return { status: "invalid_body" as const };

  const data: any = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return { status: "missing_name" as const };
    const conflict = await findHrDepartmentNameConflict(name, id);
    if (conflict) return { status: "duplicate_name" as const };
    data.name = name;
  }
  if (body.description !== undefined) data.description = body.description || null;
  if (body.status !== undefined) data.status = body.status === "inactive" ? "inactive" : "active";
  if (body.headId !== undefined) data.headId = body.headId || null;
  if (body.teamLeaderIds !== undefined) {
    data.teamLeaderIds = stringifyJson(Array.isArray(body.teamLeaderIds) ? body.teamLeaderIds : []);
  }
  if (body.policy !== undefined) {
    data.policy = stringifyJson(body.policy && typeof body.policy === "object" ? body.policy : {});
  }

  const department = await updateHrDepartment(id, data);
  return { status: "ok" as const, department };
}

export async function removeDepartment(input: { user: SessionUser; id: string }) {
  if (!HR_ROLES.includes(input.user.role || "")) return { status: "forbidden" as const };

  const dept = await findHrDepartmentById(input.id);
  if (!dept) return { status: "not_found" as const };

  const inUse = await countHrRecordsInDepartment(dept.name);
  if (inUse > 0) return { status: "in_use" as const, inUse };

  await deleteHrDepartment(input.id);
  return { status: "ok" as const };
}

export async function addDepartmentDocument(input: { user: SessionUser; departmentId: string; body: any }) {
  const { user, departmentId, body } = input;
  if (!HR_ROLES.includes(user.role || "")) return { status: "forbidden" as const };

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const fileUrl = body?.fileUrl ? normalizeWebUrl(body.fileUrl) : null;
  if (!name || !fileUrl) return { status: "missing_fields" as const };

  const document = await createDepartmentDocument({ departmentId, name: name.slice(0, 160), fileUrl });
  return { status: "ok" as const, document };
}

export async function removeDepartmentDocument(input: { user: SessionUser; docId: string }) {
  if (!HR_ROLES.includes(input.user.role || "")) return { status: "forbidden" as const };
  await deleteDepartmentDocument(input.docId);
  return { status: "ok" as const };
}

export async function listSalaryAdvances(user: SessionUser) {
  const isHr = SALARY_ADVANCE_ROLES.includes(user.role || "");
  const advances = await findSalaryAdvancesScoped(isHr ? null : user.id);
  const names = new Map(
    (await findUserNamesByIds(advances.map((a) => a.userId))).map((u) => [u.id, u.name])
  );
  return advances.map((a) => ({ ...a, employeeName: names.get(a.userId) || "Unknown" }));
}

export async function submitSalaryAdvance(input: { user: SessionUser; body: any }) {
  const { user, body } = input;
  const amount = Number(body?.amount);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!amount || amount <= 0 || !reason) return { status: "missing_fields" as const };

  const advance = await createSalaryAdvanceRequest({
    userId: user.id,
    amount,
    reason,
    status: "pending_dept_head",
  });
  const hr = await findActiveHrManagerId();
  if (hr) {
    await createHrNotification({
      userId: hr.id,
      title: "New Salary Advance Request",
      message: `${user.name} requested a salary advance of ${amount} SAR.`,
      link: "/dashboard/hr",
    });
  }
  return { status: "ok" as const, advance };
}

// Workflow: pending_dept_head → approve → pending_accountant → approve → approved → markPaid → paid (or reject)
export async function decideSalaryAdvance(input: { user: SessionUser; id: string; body: any }) {
  const { user, id, body } = input;
  if (!SALARY_ADVANCE_ROLES.includes(user.role || "")) return { status: "forbidden" as const };

  const current = await findSalaryAdvanceById(id);
  if (!current) return { status: "not_found" as const };

  const action = body?.action;
  const data: any = {};
  if (action === "approve") {
    if (current.status === "pending_dept_head") {
      data.status = "pending_accountant";
      data.deptHeadApprovedById = user.id;
      data.deptHeadApprovedAt = new Date();
    } else if (current.status === "pending_accountant") {
      data.status = "approved";
      data.accountantApprovedById = user.id;
      data.accountantApprovedAt = new Date();
    } else {
      return { status: "cannot_approve" as const };
    }
  } else if (action === "reject") {
    data.status = "rejected";
    data.rejectionReason = typeof body?.reason === "string" ? body.reason : null;
  } else if (action === "markPaid") {
    if (current.status !== "approved") return { status: "not_approved_yet" as const };
    data.status = "paid";
    data.paidAt = new Date();
  } else {
    return { status: "invalid_action" as const };
  }

  const advance = await updateSalaryAdvanceById(id, data);
  await createHrNotification({
    userId: current.userId,
    title: "Salary Advance Update",
    message: `Your salary advance request is now: ${advance.status.replace(/_/g, " ")}.`,
    link: "/dashboard/hr",
  });
  return { status: "ok" as const, advance };
}

// ── Attendance check-in/out with lateness deductions ──

function lateDeductionHours(lateMinutes: number) {
  if (lateMinutes <= 18) return 0;
  if (lateMinutes <= 35) return 2;
  if (lateMinutes <= 90) return 4;
  return 6;
}

async function draftAttendanceDeduction(userId: string, deductionHours: number) {
  if (deductionHours <= 0) return null;
  const hr = await findHrRecordSalaryFields(userId);
  const baseSalary = hr?.currentSalary || hr?.baseSalary || 0;
  const workingHours = hr?.workingHoursPerDay || 8;
  const hourlyRate = baseSalary > 0 ? baseSalary / 26 / workingHours : 0;
  return Math.round(hourlyRate * deductionHours * 100) / 100;
}

export async function recordAttendanceAction(input: { userId: string; action: any }) {
  const { userId, action } = input;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const record = await findAttendanceSince(userId, today);

  if (action === "checkIn") {
    if (record) return { status: "already_checked_in" as const };

    const checkInTime = new Date();
    const shiftStart = new Date();
    shiftStart.setHours(9, 0, 0, 0);

    const lateMinutes = Math.max(0, Math.floor((checkInTime.getTime() - shiftStart.getTime()) / 60000));
    const deductionHours = lateDeductionHours(lateMinutes);
    const deductionDraft = await draftAttendanceDeduction(userId, deductionHours);

    const created = await createAttendanceRecord({
      userId,
      date: new Date(),
      checkIn: checkInTime,
      lateMinutes,
      deductionHours,
      deductionDraft,
      status: lateMinutes > 18 ? "late" : "on_time",
    });
    return { status: "checked_in" as const, record: created };
  }

  if (action === "checkOut") {
    if (!record || record.checkOut) {
      return { status: "no_active_check_in" as const };
    }
    const checkOut = new Date();
    const shiftEnd = new Date();
    shiftEnd.setHours(17, 0, 0, 0);
    const earlyLeaveMinutes = Math.max(0, Math.floor((shiftEnd.getTime() - checkOut.getTime()) / 60000));
    const earlyHours = earlyLeaveMinutes >= 60 ? 4 : 0;
    const deductionHours = (record.deductionHours || 0) + earlyHours;
    const deductionDraft = await draftAttendanceDeduction(userId, deductionHours);

    const updated = await updateAttendanceRecord(record.id, {
      checkOut,
      earlyLeaveMinutes,
      deductionHours,
      deductionDraft,
      status: earlyHours > 0 ? "early_leave" : record.status,
    });
    return { status: "checked_out" as const, record: updated };
  }

  return { status: "invalid_action" as const };
}

/**
 * HR approves, rejects, or edits a drafted lateness deduction.
 * Only an approved deduction should be picked up by payroll.
 */
export async function decideAttendanceDeduction(input: { id: any; action: any; deductionDraft: any }) {
  const { id, action, deductionDraft } = input;
  if (!id || !action) return { status: "missing_fields" as const };

  let data: any = {};
  if (action === "approve") {
    data = { deductionApproved: true };
    if (deductionDraft !== undefined) data.deductionDraft = Number(deductionDraft) || 0;
  } else if (action === "reject") {
    data = { deductionApproved: false, deductionDraft: null };
  } else {
    return { status: "invalid_action" as const };
  }

  const record = await updateAttendanceRecord(id, data);
  return { status: "ok" as const, record };
}
