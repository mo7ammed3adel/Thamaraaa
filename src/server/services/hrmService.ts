import { prisma } from "@/lib/prisma";
import { calculateSlaStatus, candidateMatchScore, salaryChangeMetrics } from "@/lib/hrmsCore";
import { monthRange } from "@/lib/payslip";
import { sumLineItems } from "@/lib/commissions";

const WORKING_DAYS_PER_MONTH = 26;
const DEFAULT_SETTINGS: Record<string, string> = {
  hr_contact_name: "Sama",
  company_name: "Viral",
  months_between_evaluations: "3",
  leave_eligibility_days: "90",
  leave_accrual_rate_per_month: "1.75",
};

type HrmResource =
  | "department"
  | "payrollPeriod"
  | "payrollPeriodStatus"
  | "salaryAdvance"
  | "recruitmentRequest"
  | "kpiTemplate"
  | "employeeExit"
  | "complaint"
  | "complaintNote"
  | "warning"
  | "contract"
  | "folder"
  | "asset"
  | "devicePassword"
  | "setting"
  | "workflow"
  | "workflowStep"
  | "requestType"
  | "hrRequest"
  | "hrRequestBulk"
  | "requestComment"
  | "delegation"
  | "requestTag"
  | "shift"
  | "shiftAssignment"
  | "holiday"
  | "attendanceAdjustment"
  | "candidate"
  | "candidateProcess"
  | "interview"
  | "interviewFeedback"
  | "offer"
  | "salaryChange"
  | "promotion"
  | "compensationItem";

export async function getViralHrmDashboard(month?: string | null) {
  const periodMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonth();
  await ensureEmployeeProfileDefaults();

  const [
    employees,
    departments,
    payrollPeriods,
    salaryAdvances,
    recruitmentRequests,
    kpiTemplates,
    exits,
    complaints,
    warnings,
    contracts,
    folders,
    assets,
    devicePasswords,
    settings,
    activityLogs,
    settingAudits,
    workflows,
    requestTypes,
    hrRequests,
    delegations,
    requestTags,
    shifts,
    shiftAssignments,
    holidays,
    attendanceAdjustments,
    candidates,
    candidateProcesses,
    interviews,
    offers,
    salaryChanges,
    promotions,
    compensationItems,
  ] = await Promise.all([
    prisma.user.findMany({
      include: { hrRecord: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.hrDepartment.findMany({ orderBy: { name: "asc" } }),
    prisma.hrPayrollPeriod.findMany({
      include: { entries: { orderBy: { employeeName: "asc" } } },
      orderBy: { month: "desc" },
    }),
    prisma.salaryAdvance.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.recruitmentRequest.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.kpiTemplate.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } }),
    prisma.employeeExit.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.hrComplaint.findMany({ include: { notes: true }, orderBy: { createdAt: "desc" } }),
    prisma.hrWarning.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.hrContract.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.employeeFolder.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.employeeAsset.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.devicePassword.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.hrSystemSetting.findMany(),
    prisma.hrActivityLog.findMany({ orderBy: { createdAt: "desc" }, take: 80 }),
    prisma.hrSettingAudit.findMany({ orderBy: { createdAt: "desc" }, take: 80 }),
    prisma.hrWorkflow.findMany({ include: { steps: { orderBy: { stepNumber: "asc" } } }, orderBy: { updatedAt: "desc" } }),
    prisma.hrRequestType.findMany({ orderBy: { name: "asc" } }),
    prisma.hrRequest.findMany({ include: { timeline: { orderBy: { createdAt: "asc" } }, comments: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } }),
    prisma.hrRequestDelegation.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.hrRequestTag.findMany({ orderBy: { name: "asc" } }),
    prisma.hrShift.findMany({ orderBy: { name: "asc" } }),
    prisma.hrShiftAssignment.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.hrOfficialHoliday.findMany({ orderBy: { startDate: "asc" } }),
    prisma.hrAttendanceAdjustment.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.hrCandidate.findMany({ include: { processes: { orderBy: { createdAt: "desc" } } }, orderBy: { updatedAt: "desc" } }),
    prisma.hrCandidateProcess.findMany({ include: { candidate: true }, orderBy: { updatedAt: "desc" } }),
    prisma.hrInterview.findMany({ include: { feedback: true, process: { include: { candidate: true } } }, orderBy: { interviewDateTime: "desc" } }),
    prisma.hrOffer.findMany({ include: { process: { include: { candidate: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.hrSalaryChangeRequest.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.hrPromotion.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.hrCompensationItem.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const userNames = new Map(employees.map((employee) => [employee.id, employee.name]));
  const employeeCodes = new Map(employees.map((employee) => [employee.id, employee.hrRecord?.employeeCode || null]));

  // Collapse KPI templates to their latest version, with a count of total versions
  // per logical template so HR can see history is preserved.
  const kpiVersionCounts = new Map<string, number>();
  for (const template of kpiTemplates) {
    const rootKey = template.rootId ?? template.id;
    kpiVersionCounts.set(rootKey, (kpiVersionCounts.get(rootKey) || 0) + 1);
  }
  const latestKpiTemplates = kpiTemplates
    .filter((template) => template.isLatest)
    .map((template) => ({ ...template, versionCount: kpiVersionCounts.get(template.rootId ?? template.id) || 1 }));
  const settingsMap = {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
  };

  return {
    month: periodMonth,
    overview: {
      employees: employees.length,
      activeEmployees: employees.filter((employee) => employee.status === "Active").length,
      departments: departments.length,
      openComplaints: complaints.filter((complaint) => complaint.status !== "closed").length,
      pendingAdvances: salaryAdvances.filter((advance) => String(advance.status).startsWith("pending")).length,
      openRecruitment: recruitmentRequests.filter((request) => request.status !== "closed").length,
      pendingCentralRequests: hrRequests.filter((request) => request.status === "submitted" || request.status === "pending").length,
      overdueRequests: hrRequests.filter((request) => request.slaStatus === "overdue").length,
      activeWorkflows: workflows.filter((workflow) => workflow.active).length,
      talentPool: candidates.filter((candidate) => !candidate.archived).length,
      interviewsToday: interviews.filter((interview) => sameCalendarDay(interview.interviewDateTime, new Date())).length,
      pendingSalaryChanges: salaryChanges.filter((request) => request.status === "pending").length,
    },
    employees: employees.map((employee) => ({
      ...employee,
      displayDepartment: employee.hrRecord?.department || roleDepartment(employee.role),
      displayJobTitle: employee.hrRecord?.jobTitle || employee.role.replace(/_/g, " "),
    })),
    departments: departments.map((department) => ({
      ...department,
      employeeCount: employees.filter(
        (employee) => (employee.hrRecord?.department || roleDepartment(employee.role)) === department.name
      ).length,
    })),
    payrollPeriods,
    salaryAdvances: salaryAdvances.map((advance) => ({
      ...advance,
      employeeName: userNames.get(advance.userId) || "Unknown",
    })),
    recruitmentRequests,
    kpiTemplates: latestKpiTemplates,
    devicePasswords: devicePasswords.map((entry) => ({
      ...entry,
      employeeName: userNames.get(entry.userId) || "Unknown",
      employeeCode: employeeCodes.get(entry.userId) || null,
    })),
    exits: exits.map((exit) => ({ ...exit, employeeName: userNames.get(exit.userId) || "Unknown" })),
    complaints: complaints.map((complaint) => ({ ...complaint, employeeName: userNames.get(complaint.userId) || "Unknown" })),
    warnings: warnings.map((warning) => ({ ...warning, employeeName: userNames.get(warning.userId) || "Unknown" })),
    contracts: contracts.map((contract) => ({ ...contract, employeeName: userNames.get(contract.userId) || "Unknown" })),
    folders: folders.map((folder) => ({ ...folder, employeeName: userNames.get(folder.userId) || "Unknown" })),
    assets: assets.map((asset) => ({ ...asset, employeeName: userNames.get(asset.userId) || "Unknown" })),
    settings: settingsMap,
    activityLogs: activityLogs.map((entry) => ({
      ...entry,
      actorName: entry.actorId ? userNames.get(entry.actorId) || "Unknown" : "System",
      employeeName: entry.employeeId ? userNames.get(entry.employeeId) || "Unknown" : null,
    })),
    settingAudits: settingAudits.map((entry) => ({
      ...entry,
      changedByName: entry.changedById ? userNames.get(entry.changedById) || "Unknown" : "System",
    })),
    workflows,
    requestTypes,
    hrRequests: hrRequests.map((request) => ({
      ...request,
      employeeName: userNames.get(request.userId) || "Unknown",
      assignedApproverName: request.assignedApproverId ? userNames.get(request.assignedApproverId) || "Unknown" : null,
      assignedHrName: request.assignedHrId ? userNames.get(request.assignedHrId) || "Unknown" : null,
    })),
    delegations: delegations.map((delegation) => ({
      ...delegation,
      delegatorName: userNames.get(delegation.delegatorId) || "Unknown",
      delegateName: userNames.get(delegation.delegateId) || "Unknown",
    })),
    requestTags,
    shifts,
    shiftAssignments,
    holidays,
    attendanceAdjustments: attendanceAdjustments.map((adjustment) => ({
      ...adjustment,
      employeeName: userNames.get(adjustment.userId) || "Unknown",
    })),
    candidates,
    candidateProcesses,
    interviews,
    offers,
    salaryChanges: salaryChanges.map((request) => ({
      ...request,
      employeeName: userNames.get(request.userId) || "Unknown",
    })),
    promotions: promotions.map((promotion) => ({
      ...promotion,
      employeeName: userNames.get(promotion.userId) || "Unknown",
    })),
    compensationItems: compensationItems.map((item) => ({
      ...item,
      employeeName: userNames.get(item.userId) || "Unknown",
    })),
  };
}

async function ensureEmployeeProfileDefaults() {
  const defaultFolders = ["Contracts", "Identity", "Payroll", "Reviews", "Assets"];

  const users = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      level: true,
      status: true,
      createdAt: true,
      hrRecord: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const salaryRows = await prisma.salaryHistory.findMany({ select: { userId: true } });
  const usersWithSalaryHistory = new Set(salaryRows.map((row) => row.userId));
  const usedCodes = new Set(
    users
      .map((user) => user.hrRecord?.employeeCode)
      .filter((code): code is string => Boolean(code))
  );
  let nextCodeNumber = 1;

  const nextEmployeeCode = () => {
    while (nextCodeNumber < 10000) {
      const code = `VRL-${String(nextCodeNumber).padStart(4, "0")}`;
      nextCodeNumber += 1;
      if (!usedCodes.has(code)) {
        usedCodes.add(code);
        return code;
      }
    }
    const fallback = `VRL-${Date.now().toString().slice(-4)}`;
    usedCodes.add(fallback);
    return fallback;
  };

  const hrRecordCreates: any[] = [];
  const hrRecordUpdates: Array<Promise<unknown>> = [];
  const salaryHistoryCreates: any[] = [];
  const folderCreates: any[] = [];

  for (const user of users) {
    const department = roleDepartment(user.role);
    const jobTitle = user.role.replace(/_/g, " ");
    const hireDate = user.hrRecord?.hiringDate || user.createdAt;
    let salaryForHistory = user.hrRecord?.currentSalary ?? user.hrRecord?.baseSalary ?? 0;

    if (!user.hrRecord) {
      hrRecordCreates.push({
        userId: user.id,
        baseSalary: 0,
        level: user.level || "Junior",
        monthlyTarget: 0,
        performanceHistory: "[]",
        employeeCode: nextEmployeeCode(),
        department,
        jobTitle,
        hiringDate: user.createdAt,
        employmentType: "full-time",
        employmentStatus: user.status === "Active" ? "active" : "inactive",
        startingSalary: 0,
        currentSalary: 0,
      });
    } else {
      const updateData: Record<string, any> = {};
      if (!user.hrRecord.employeeCode) updateData.employeeCode = nextEmployeeCode();
      if (!user.hrRecord.department) updateData.department = department;
      if (!user.hrRecord.jobTitle) updateData.jobTitle = jobTitle;
      if (!user.hrRecord.hiringDate) updateData.hiringDate = user.createdAt;
      if (!user.hrRecord.employmentType) updateData.employmentType = "full-time";
      if (!user.hrRecord.employmentStatus) updateData.employmentStatus = user.status === "Active" ? "active" : "inactive";
      if (user.hrRecord.startingSalary == null) updateData.startingSalary = user.hrRecord.baseSalary || 0;
      if (user.hrRecord.currentSalary == null) {
        updateData.currentSalary = user.hrRecord.baseSalary || 0;
        salaryForHistory = updateData.currentSalary;
      }
      if (Object.keys(updateData).length > 0) {
        hrRecordUpdates.push(prisma.hrRecord.update({ where: { userId: user.id }, data: updateData }));
      }
    }

    if (!usersWithSalaryHistory.has(user.id)) {
      salaryHistoryCreates.push({
        userId: user.id,
        effectiveDate: hireDate,
        previousSalary: 0,
        newSalary: salaryForHistory,
        increaseAmount: salaryForHistory,
        increasePct: 0,
        changeType: "hire",
        reviewStatus: "completed",
        notes: "Backfilled from HRM setup",
      });
    }

    folderCreates.push(...defaultFolders.map((name) => ({ userId: user.id, name })));
  }

  if (hrRecordCreates.length > 0) {
    await prisma.hrRecord.createMany({ data: hrRecordCreates, skipDuplicates: true });
  }
  if (hrRecordUpdates.length > 0) {
    await Promise.all(hrRecordUpdates);
  }
  if (salaryHistoryCreates.length > 0) {
    await prisma.salaryHistory.createMany({ data: salaryHistoryCreates });
  }
  if (folderCreates.length > 0) {
    await prisma.employeeFolder.createMany({ data: folderCreates, skipDuplicates: true });
  }
}

export async function createHrmResource(input: {
  actorId: string;
  resource: HrmResource;
  body: any;
}) {
  const { actorId, resource, body } = input;

  if (resource === "department") {
    return prisma.hrDepartment.create({
      data: {
        name: clean(body.name),
        parentId: body.parentId || null,
      },
    });
  }

  if (resource === "payrollPeriod") {
    return generatePayrollPeriod({
      actorId,
      month: body.month,
      notes: body.notes || null,
      bonusSubmissionDeadline: body.bonusSubmissionDeadline || null,
    });
  }

  if (resource === "salaryAdvance") {
    const eligibility = await salaryAdvanceEligibility(body.userId, Number(body.amount) || 0);
    if (!eligibility.ok) {
      return { status: "rejected_by_rule" as const, reason: eligibility.reason };
    }
    return prisma.salaryAdvance.create({
      data: {
        userId: body.userId,
        amount: Number(body.amount) || 0,
        reason: clean(body.reason),
        status: "pending_dept_head",
      },
    });
  }

  if (resource === "recruitmentRequest") {
    return prisma.recruitmentRequest.create({
      data: {
        departmentId: body.departmentId || null,
        departmentName: body.departmentName || null,
        positionTitle: clean(body.positionTitle),
        level: body.level || "junior",
        minExperience: body.minExperience || null,
        requiredStartDate: toDateOrNull(body.requiredStartDate),
        vacancies: Number(body.vacancies) || 1,
        notes: body.notes || null,
        status: body.status || "pending",
        assignedHrId: body.assignedHrId || null,
        requestedById: actorId,
      },
    });
  }

  if (resource === "kpiTemplate") {
    const items = normalizeKpiItems(body.items);
    const weightTotal = items.reduce((sum, item) => sum + item.weight, 0);
    if (Math.round(weightTotal) !== 100) {
      return { status: "invalid_weights" as const, total: weightTotal };
    }
    return prisma.kpiTemplate.create({
      data: {
        name: clean(body.name),
        departmentId: body.departmentId || null,
        departmentName: body.departmentName || null,
        targetRole: body.targetRole || "employee",
        active: body.active !== false,
        items: { create: items },
      },
      include: { items: true },
    });
  }

  if (resource === "employeeExit") {
    return prisma.employeeExit.create({
      data: {
        userId: body.userId,
        exitType: body.exitType || "resignation",
        submissionDate: toDateOrNow(body.submissionDate),
        notificationDate: toDateOrNull(body.notificationDate),
        lastWorkingDay: toDateOrNull(body.lastWorkingDay),
        requiredNoticeDays: Number(body.requiredNoticeDays) || 0,
        noticeStatus: body.noticeStatus || "pending",
        clearanceStatus: body.clearanceStatus || "pending",
        finalSalaryStatus: body.finalSalaryStatus || "pending",
        assetChecklist: JSON.stringify(body.assetChecklist || {}),
        exitInterviewNotes: body.exitInterviewNotes || null,
        initiatedById: actorId,
      },
    });
  }

  if (resource === "complaint") {
    return prisma.hrComplaint.create({
      data: {
        userId: body.userId,
        subject: clean(body.subject),
        details: clean(body.details),
        attachmentUrl: body.attachmentUrl || null,
        visibility: body.visibility || "hr_only",
        assignedHrId: body.assignedHrId || null,
      },
    });
  }

  if (resource === "complaintNote") {
    return prisma.hrComplaintNote.create({
      data: {
        complaintId: body.complaintId,
        authorId: actorId,
        note: clean(body.note),
      },
    });
  }

  if (resource === "warning") {
    const warning = await prisma.hrWarning.create({
      data: {
        userId: body.userId,
        type: body.type || "administrative",
        date: toDateOrNow(body.date),
        description: clean(body.description),
        issuedById: actorId,
        attachmentUrl: body.attachmentUrl || null,
        payrollDeduction: Number(body.payrollDeduction) || 0,
      },
    });
    await prisma.hrRecord.updateMany({
      where: { userId: body.userId },
      data: { warningCount: { increment: 1 } },
    });
    return warning;
  }

  if (resource === "contract") {
    return prisma.hrContract.create({
      data: {
        userId: body.userId,
        title: clean(body.title),
        startDate: toDateOrNow(body.startDate),
        endDate: toDateOrNull(body.endDate),
        notes: body.notes || null,
        fileUrl: body.fileUrl || null,
      },
    });
  }

  if (resource === "folder") {
    return prisma.employeeFolder.create({
      data: {
        userId: body.userId,
        name: clean(body.name),
      },
    });
  }

  if (resource === "asset") {
    return prisma.employeeAsset.create({
      data: {
        userId: body.userId,
        assetType: body.assetType || "other",
        returned: Boolean(body.returned),
        notes: body.notes || null,
      },
    });
  }

  if (resource === "devicePassword") {
    // Always keep only the latest password per employee (no history).
    if (!body.userId || !clean(body.password)) {
      return { status: "missing_fields" as const };
    }
    return prisma.devicePassword.upsert({
      where: { userId: body.userId },
      update: { password: clean(body.password), updatedById: actorId },
      create: { userId: body.userId, password: clean(body.password), updatedById: actorId },
    });
  }

  if (resource === "workflow") {
    const steps = normalizeWorkflowSteps(body.steps);
    const workflow = await prisma.hrWorkflow.create({
      data: {
        name: clean(body.name),
        description: body.description || null,
        moduleName: body.moduleName || "requests",
        requestTypeKey: body.requestTypeKey || null,
        active: body.active !== false,
        rejectionRule: body.rejectionRule || "end_workflow",
        escalationEnabled: Boolean(body.escalationEnabled),
        escalateAfterHours: numberOrNull(body.escalateAfterHours),
        escalateTo: body.escalateTo || null,
        createdById: actorId,
        steps: steps.length ? { create: steps } : undefined,
      },
      include: { steps: { orderBy: { stepNumber: "asc" } } },
    });
    await logHrmActivity({ actorId, module: "workflow", action: "created", entityType: "HrWorkflow", entityId: workflow.id, newValue: workflow });
    return workflow;
  }

  if (resource === "workflowStep") {
    return prisma.hrWorkflowStep.create({
      data: {
        workflowId: body.workflowId,
        stepNumber: Number(body.stepNumber) || 1,
        name: clean(body.name),
        approverType: body.approverType || "hr_manager",
        approverValue: body.approverValue || null,
        required: body.required !== false,
        mode: body.mode || "sequential",
        autoApprove: Boolean(body.autoApprove),
        skipWhen: body.skipWhen || null,
        notifications: stringifyJson(body.notifications || {}),
        escalationHours: numberOrNull(body.escalationHours),
        escalateTo: body.escalateTo || null,
      },
    });
  }

  if (resource === "requestType") {
    return prisma.hrRequestType.create({
      data: {
        key: clean(body.key || slugify(body.name)),
        name: clean(body.name),
        category: body.category || "general",
        active: body.active !== false,
        responseSlaHours: Number(body.responseSlaHours) || 24,
        approvalSlaHours: Number(body.approvalSlaHours) || 48,
        escalationHours: Number(body.escalationHours) || 72,
        workflowId: body.workflowId || null,
        instructions: body.instructions || null,
        fieldsJson: stringifyJson(parseMaybeJson(body.fieldsJson, body.fields || [])),
        requiredAttachment: Boolean(body.requiredAttachment),
      },
    });
  }

  if (resource === "hrRequest") {
    return createCentralHrRequest({ actorId, body });
  }

  if (resource === "requestComment") {
    return prisma.hrRequestComment.create({
      data: {
        requestId: body.requestId,
        authorId: actorId,
        visibility: body.visibility || "internal",
        body: clean(body.body),
        attachmentUrl: body.attachmentUrl || null,
      },
    });
  }

  if (resource === "delegation") {
    return prisma.hrRequestDelegation.create({
      data: {
        delegatorId: body.delegatorId,
        delegateId: body.delegateId,
        startDate: toDateOrNow(body.startDate),
        endDate: toDateOrNow(body.endDate),
        reason: clean(body.reason),
        active: body.active !== false,
        createdById: actorId,
      },
    });
  }

  if (resource === "requestTag") {
    return prisma.hrRequestTag.create({ data: { name: clean(body.name), color: body.color || null } });
  }

  if (resource === "shift") {
    return prisma.hrShift.create({
      data: {
        name: clean(body.name),
        startTime: body.startTime || "09:00",
        endTime: body.endTime || "17:00",
        breakMinutes: Number(body.breakMinutes) || 0,
        workingHours: Number(body.workingHours) || 8,
        lateGraceMinutes: Number(body.lateGraceMinutes) || 15,
        earlyLeaveGraceMinutes: Number(body.earlyLeaveGraceMinutes) || 15,
        overtimeEligible: Boolean(body.overtimeEligible),
        active: body.active !== false,
      },
    });
  }

  if (resource === "shiftAssignment") {
    return prisma.hrShiftAssignment.create({
      data: {
        shiftId: body.shiftId,
        targetType: body.targetType || "employee",
        targetValue: body.targetValue,
        effectiveFrom: toDateOrNow(body.effectiveFrom),
        effectiveTo: toDateOrNull(body.effectiveTo),
        createdById: actorId,
      },
    });
  }

  if (resource === "holiday") {
    return prisma.hrOfficialHoliday.create({
      data: {
        name: clean(body.name),
        startDate: toDateOrNow(body.startDate),
        endDate: toDateOrNow(body.endDate || body.startDate),
        appliesTo: body.appliesTo || "all",
        departmentIdsJson: stringifyJson(parseMaybeJson(body.departmentIdsJson, body.departmentIds || [])),
        createdById: actorId,
      },
    });
  }

  if (resource === "attendanceAdjustment") {
    return prisma.hrAttendanceAdjustment.create({
      data: {
        userId: body.userId,
        requestId: body.requestId || null,
        requestDate: toDateOrNow(body.requestDate),
        adjustmentType: body.adjustmentType || "other",
        correctTime: toDateOrNow(body.correctTime),
        originalRecordJson: body.originalRecordJson || null,
        reason: clean(body.reason),
        attachmentUrl: body.attachmentUrl || null,
        status: body.status || "pending",
      },
    });
  }

  if (resource === "candidate") {
    return prisma.hrCandidate.create({
      data: {
        fullName: clean(body.fullName || body.name),
        phone: clean(body.phone),
        email: clean(body.email),
        linkedinUrl: body.linkedinUrl || null,
        portfolioUrl: body.portfolioUrl || null,
        currentCompany: body.currentCompany || null,
        currentPosition: body.currentPosition || null,
        expectedSalary: numberOrNull(body.expectedSalary),
        noticePeriod: body.noticePeriod || null,
        yearsOfExperience: numberOrNull(body.yearsOfExperience),
        city: body.city || null,
        source: body.source || null,
        skillsJson: stringifyJson(parseMaybeJson(body.skillsJson, splitList(body.skills))),
        cvUrl: body.cvUrl || null,
        notes: body.notes || null,
      },
    });
  }

  if (resource === "candidateProcess") {
    return createCandidateProcess(body);
  }

  if (resource === "interview") {
    return prisma.hrInterview.create({
      data: {
        processId: body.processId,
        interviewType: body.interviewType || "hr_interview",
        interviewDateTime: toDateOrNow(body.interviewDateTime),
        interviewerId: body.interviewerId || null,
        location: body.location || null,
        meetingLink: body.meetingLink || null,
        notes: body.notes || null,
        status: body.status || "scheduled",
      },
    });
  }

  if (resource === "interviewFeedback") {
    return createInterviewFeedback({ actorId, body });
  }

  if (resource === "offer") {
    return prisma.hrOffer.create({
      data: {
        processId: body.processId,
        offeredSalary: Number(body.offeredSalary) || 0,
        jobTitle: clean(body.jobTitle),
        departmentName: body.departmentName || null,
        employmentType: body.employmentType || "full-time",
        workMode: body.workMode || "onsite",
        joiningDate: toDateOrNull(body.joiningDate),
        expirationDate: toDateOrNull(body.expirationDate),
        notes: body.notes || null,
        status: body.status || "pending",
        createdById: actorId,
      },
    });
  }

  if (resource === "salaryChange") {
    return createSalaryChange({ actorId, body });
  }

  if (resource === "promotion") {
    return prisma.hrPromotion.create({
      data: {
        userId: body.userId,
        promotionType: body.promotionType || "promotion",
        currentDepartment: body.currentDepartment || null,
        newDepartment: body.newDepartment || null,
        currentJobPosition: body.currentJobPosition || null,
        newJobPosition: body.newJobPosition || null,
        currentSalary: numberOrNull(body.currentSalary),
        newSalary: numberOrNull(body.newSalary),
        reason: clean(body.reason),
        effectiveDate: toDateOrNow(body.effectiveDate),
        notes: body.notes || null,
        attachmentUrl: body.attachmentUrl || null,
        status: body.status || "pending",
        createdById: actorId,
      },
    });
  }

  if (resource === "compensationItem") {
    return prisma.hrCompensationItem.create({
      data: {
        userId: body.userId,
        itemType: body.itemType || "bonus",
        category: body.category || "other",
        amount: Number(body.amount) || 0,
        startDate: toDateOrNow(body.startDate),
        endDate: toDateOrNull(body.endDate),
        recurring: Boolean(body.recurring),
        reason: body.reason || null,
        notes: body.notes || null,
        attachmentUrl: body.attachmentUrl || null,
        approvedById: body.approvedById || null,
        createdById: actorId,
      },
    });
  }

  if (resource === "setting") {
    const key = clean(body.key);
    const previous = await prisma.hrSystemSetting.findUnique({ where: { key } });
    const setting = await prisma.hrSystemSetting.upsert({
      where: { key: clean(body.key) },
      update: { value: String(body.value ?? ""), updatedById: actorId },
      create: { key: clean(body.key), value: String(body.value ?? ""), updatedById: actorId },
    });
    await prisma.hrSettingAudit.create({
      data: {
        key,
        previousValue: previous?.value || null,
        newValue: setting.value,
        changedById: actorId,
      },
    });
    return setting;
  }

  return { status: "unknown_resource" as const };
}

export async function updateHrmResource(input: {
  actorId: string;
  resource: HrmResource;
  body: any;
}) {
  const { actorId, resource, body } = input;
  if (!body.id && resource !== "setting" && resource !== "devicePassword" && resource !== "hrRequestBulk") return { status: "missing_id" as const };

  if (resource === "department") {
    return prisma.hrDepartment.update({
      where: { id: body.id },
      data: { name: body.name, parentId: body.parentId || null },
    });
  }

  if (resource === "payrollPeriodStatus") {
    return updatePayrollStatus({ actorId, id: body.id, status: body.status, reason: body.reason || null });
  }

  if (resource === "salaryAdvance") {
    return updateSalaryAdvance({ actorId, id: body.id, status: body.status, rejectionReason: body.rejectionReason });
  }

  if (resource === "recruitmentRequest") {
    return prisma.recruitmentRequest.update({
      where: { id: body.id },
      data: {
        status: body.status,
        assignedHrId: body.assignedHrId || undefined,
        notes: body.notes ?? undefined,
      },
    });
  }

  if (resource === "kpiTemplate") {
    // Structural edit (items present) → create a NEW version; the previous version
    // stays immutable so completed evaluations keep their original KPI structure.
    if (Array.isArray(body.items)) {
      const items = normalizeKpiItems(body.items);
      const total = items.reduce((sum, item) => sum + item.weight, 0);
      if (Math.round(total) !== 100) return { status: "invalid_weights" as const, total };

      const current = await prisma.kpiTemplate.findUnique({ where: { id: body.id } });
      if (!current) return { status: "missing_id" as const };
      const rootKey = current.rootId ?? current.id;

      return prisma.$transaction(async (tx) => {
        await tx.kpiTemplate.update({ where: { id: current.id }, data: { isLatest: false } });
        return tx.kpiTemplate.create({
          data: {
            name: body.name ?? current.name,
            departmentId: current.departmentId,
            departmentName: body.departmentName ?? current.departmentName,
            targetRole: body.targetRole ?? current.targetRole,
            active: body.active ?? current.active,
            version: current.version + 1,
            isLatest: true,
            rootId: rootKey,
            items: { create: items },
          },
          include: { items: true },
        });
      });
    }
    // Non-structural change (activate/deactivate) → in place; never affects history.
    return prisma.kpiTemplate.update({ where: { id: body.id }, data: { active: body.active } });
  }

  if (resource === "devicePassword") {
    if (!body.userId || !clean(body.password)) {
      return { status: "missing_fields" as const };
    }
    return prisma.devicePassword.upsert({
      where: { userId: body.userId },
      update: { password: clean(body.password), updatedById: actorId },
      create: { userId: body.userId, password: clean(body.password), updatedById: actorId },
    });
  }

  if (resource === "employeeExit") {
    return prisma.employeeExit.update({
      where: { id: body.id },
      data: {
        noticeStatus: body.noticeStatus,
        clearanceStatus: body.clearanceStatus,
        finalSalaryStatus: body.finalSalaryStatus,
        archiveStatus: body.archiveStatus,
        archivedById: body.archiveStatus === "archived" ? actorId : undefined,
        archivedAt: body.archiveStatus === "archived" ? new Date() : undefined,
        hrOverride: body.hrOverride,
        hrOverrideReason: body.hrOverrideReason,
      },
    });
  }

  if (resource === "complaint") {
    return prisma.hrComplaint.update({
      where: { id: body.id },
      data: {
        status: body.status,
        assignedHrId: body.assignedHrId || undefined,
      },
    });
  }

  if (resource === "asset") {
    return prisma.employeeAsset.update({
      where: { id: body.id },
      data: { returned: Boolean(body.returned), notes: body.notes ?? undefined },
    });
  }

  if (resource === "workflow") {
    return updateWorkflow({ actorId, body });
  }

  if (resource === "requestType") {
    return prisma.hrRequestType.update({
      where: { id: body.id },
      data: {
        name: body.name,
        category: body.category,
        active: body.active,
        responseSlaHours: body.responseSlaHours !== undefined ? Number(body.responseSlaHours) || 24 : undefined,
        approvalSlaHours: body.approvalSlaHours !== undefined ? Number(body.approvalSlaHours) || 48 : undefined,
        escalationHours: body.escalationHours !== undefined ? Number(body.escalationHours) || 72 : undefined,
        workflowId: body.workflowId ?? undefined,
        instructions: body.instructions ?? undefined,
        fieldsJson: body.fieldsJson !== undefined ? stringifyJson(parseMaybeJson(body.fieldsJson, [])) : undefined,
        requiredAttachment: body.requiredAttachment,
      },
    });
  }

  if (resource === "hrRequest") {
    return updateCentralHrRequest({ actorId, body });
  }

  if (resource === "hrRequestBulk") {
    return updateCentralHrRequestsBulk({ actorId, body });
  }

  if (resource === "delegation") {
    return prisma.hrRequestDelegation.update({
      where: { id: body.id },
      data: {
        active: body.active,
        endDate: body.endDate ? toDateOrNow(body.endDate) : undefined,
        reason: body.reason ?? undefined,
      },
    });
  }

  if (resource === "shift") {
    return prisma.hrShift.update({
      where: { id: body.id },
      data: {
        startTime: body.startTime,
        endTime: body.endTime,
        breakMinutes: body.breakMinutes !== undefined ? Number(body.breakMinutes) || 0 : undefined,
        workingHours: body.workingHours !== undefined ? Number(body.workingHours) || 8 : undefined,
        lateGraceMinutes: body.lateGraceMinutes !== undefined ? Number(body.lateGraceMinutes) || 15 : undefined,
        earlyLeaveGraceMinutes: body.earlyLeaveGraceMinutes !== undefined ? Number(body.earlyLeaveGraceMinutes) || 15 : undefined,
        overtimeEligible: body.overtimeEligible,
        active: body.active,
      },
    });
  }

  if (resource === "attendanceAdjustment") {
    return decideAttendanceAdjustment({ actorId, body });
  }

  if (resource === "candidateProcess") {
    return prisma.hrCandidateProcess.update({
      where: { id: body.id },
      data: {
        status: body.status,
        recruiterId: body.recruiterId ?? undefined,
        rejectionReason: body.rejectionReason ?? undefined,
      },
    });
  }

  if (resource === "interview") {
    return prisma.hrInterview.update({
      where: { id: body.id },
      data: {
        status: body.status,
        interviewDateTime: body.interviewDateTime ? toDateOrNow(body.interviewDateTime) : undefined,
        interviewerId: body.interviewerId ?? undefined,
        location: body.location ?? undefined,
        meetingLink: body.meetingLink ?? undefined,
        notes: body.notes ?? undefined,
      },
    });
  }

  if (resource === "offer") {
    return prisma.hrOffer.update({
      where: { id: body.id },
      data: {
        status: body.status,
        offeredSalary: body.offeredSalary !== undefined ? Number(body.offeredSalary) || 0 : undefined,
        expirationDate: body.expirationDate ? toDateOrNull(body.expirationDate) : undefined,
        notes: body.notes ?? undefined,
      },
    });
  }

  if (resource === "salaryChange") {
    return updateSalaryChange({ actorId, body });
  }

  if (resource === "promotion") {
    return updatePromotion({ actorId, body });
  }

  if (resource === "compensationItem") {
    return prisma.hrCompensationItem.update({
      where: { id: body.id },
      data: {
        amount: body.amount !== undefined ? Number(body.amount) || 0 : undefined,
        endDate: body.endDate ? toDateOrNull(body.endDate) : undefined,
        recurring: body.recurring,
        notes: body.notes ?? undefined,
      },
    });
  }

  if (resource === "setting") {
    const key = clean(body.key);
    const previous = await prisma.hrSystemSetting.findUnique({ where: { key } });
    const setting = await prisma.hrSystemSetting.upsert({
      where: { key },
      update: { value: String(body.value ?? ""), updatedById: actorId },
      create: { key, value: String(body.value ?? ""), updatedById: actorId },
    });
    await prisma.hrSettingAudit.create({
      data: {
        key,
        previousValue: previous?.value || null,
        newValue: setting.value,
        changedById: actorId,
      },
    });
    return setting;
  }

  return { status: "unknown_resource" as const };
}

export async function deleteHrmResource(resource: HrmResource, id: string) {
  if (resource === "department") return prisma.hrDepartment.delete({ where: { id } });
  if (resource === "kpiTemplate") return prisma.kpiTemplate.delete({ where: { id } });
  if (resource === "recruitmentRequest") return prisma.recruitmentRequest.delete({ where: { id } });
  if (resource === "complaint") return prisma.hrComplaint.delete({ where: { id } });
  if (resource === "warning") return prisma.hrWarning.delete({ where: { id } });
  if (resource === "contract") return prisma.hrContract.delete({ where: { id } });
  if (resource === "folder") return prisma.employeeFolder.delete({ where: { id } });
  if (resource === "asset") return prisma.employeeAsset.delete({ where: { id } });
  if (resource === "devicePassword") return prisma.devicePassword.delete({ where: { id } });
  if (resource === "workflow") return prisma.hrWorkflow.delete({ where: { id } });
  if (resource === "workflowStep") return prisma.hrWorkflowStep.delete({ where: { id } });
  if (resource === "requestType") return prisma.hrRequestType.update({ where: { id }, data: { active: false } });
  if (resource === "hrRequest") return prisma.hrRequest.update({ where: { id }, data: { archivedAt: new Date(), status: "archived" } });
  if (resource === "delegation") return prisma.hrRequestDelegation.update({ where: { id }, data: { active: false } });
  if (resource === "requestTag") return prisma.hrRequestTag.delete({ where: { id } });
  if (resource === "shift") return prisma.hrShift.update({ where: { id }, data: { active: false } });
  if (resource === "shiftAssignment") return prisma.hrShiftAssignment.delete({ where: { id } });
  if (resource === "holiday") return prisma.hrOfficialHoliday.delete({ where: { id } });
  if (resource === "candidate") return prisma.hrCandidate.update({ where: { id }, data: { archived: true } });
  if (resource === "candidateProcess") return prisma.hrCandidateProcess.update({ where: { id }, data: { status: "archived" } });
  if (resource === "interview") return prisma.hrInterview.delete({ where: { id } });
  if (resource === "offer") return prisma.hrOffer.delete({ where: { id } });
  if (resource === "compensationItem") return prisma.hrCompensationItem.delete({ where: { id } });
  return { status: "delete_not_supported" as const };
}

async function createCentralHrRequest(input: { actorId: string; body: any }) {
  const typeKey = clean(input.body.typeKey || input.body.requestType || "other");
  const requestType = await prisma.hrRequestType.findUnique({ where: { key: typeKey } });
  const createdAt = new Date();
  const sla = calculateSlaStatus({
    createdAt,
    responseHours: requestType?.responseSlaHours || 24,
    approvalHours: requestType?.approvalSlaHours || 48,
    now: createdAt,
  });

  return prisma.$transaction(async (tx) => {
    const request = await tx.hrRequest.create({
      data: {
        requestNumber: await nextHrRequestNumber(tx),
        userId: input.body.userId || input.actorId,
        typeKey,
        typeName: requestType?.name || clean(input.body.typeName || typeKey),
        status: input.body.status || "submitted",
        priority: input.body.priority || "medium",
        currentStep: "submitted",
        assignedApproverId: input.body.assignedApproverId || null,
        assignedHrId: input.body.assignedHrId || null,
        responseDueAt: sla.responseDueAt,
        approvalDueAt: sla.approvalDueAt,
        slaStatus: sla.status,
        payloadJson: stringifyJson(parseMaybeJson(input.body.payloadJson, input.body.payload || {})),
        attachmentsJson: stringifyJson(parseMaybeJson(input.body.attachmentsJson, input.body.attachments || [])),
        tagsJson: stringifyJson(parseMaybeJson(input.body.tagsJson, input.body.tags || [])),
        timeline: {
          create: {
            action: "submitted",
            status: input.body.status || "submitted",
            actorId: input.actorId,
            notes: input.body.notes || null,
          },
        },
      },
    });

    if (requestType?.workflowId) {
      await tx.hrWorkflowInstance.create({
        data: {
          workflowId: requestType.workflowId,
          requestId: request.id,
          requestNumber: request.requestNumber,
          subjectType: "HrRequest",
          subjectId: request.id,
          status: "pending",
          createdById: input.actorId,
        },
      });
    }

    return request;
  });
}

async function updateCentralHrRequest(input: { actorId: string; body: any }) {
  const status = input.body.status;
  const request = await prisma.hrRequest.update({
    where: { id: input.body.id },
    data: {
      status,
      priority: input.body.priority,
      currentStep: input.body.currentStep,
      assignedApproverId: input.body.assignedApproverId,
      assignedHrId: input.body.assignedHrId,
      escalatedAt: input.body.escalated ? new Date() : undefined,
      timeline: status
        ? {
            create: {
              action: status,
              status,
              actorId: input.actorId,
              notes: input.body.notes || null,
            },
          }
        : undefined,
    },
  });
  await logHrmActivity({ actorId: input.actorId, module: "requests", action: status || "updated", entityType: "HrRequest", entityId: request.id, newValue: request });
  return request;
}

async function updateCentralHrRequestsBulk(input: { actorId: string; body: any }) {
  const ids = Array.isArray(input.body.ids) ? input.body.ids.filter(Boolean) : [];
  const status = clean(input.body.status);
  if (ids.length === 0 || !status) return { status: "missing_fields" as const };

  return prisma.$transaction(async (tx) => {
    const requests = [];
    for (const id of ids) {
      const request = await tx.hrRequest.update({
        where: { id },
        data: {
          status,
          currentStep: status,
          timeline: {
            create: {
              action: `bulk_${status}`,
              status,
              actorId: input.actorId,
              notes: input.body.notes || null,
            },
          },
        },
      });
      requests.push(request);
    }

    await tx.hrActivityLog.create({
      data: {
        module: "requests",
        action: `bulk_${status}`,
        actorId: input.actorId,
        entityType: "HrRequest",
        entityId: ids.join(","),
        newValue: stringifyJson({ ids, status, count: requests.length }),
      },
    });

    return { status: "ok" as const, count: requests.length, requests };
  });
}

async function updateWorkflow(input: { actorId: string; body: any }) {
  const steps = Array.isArray(input.body.steps) ? normalizeWorkflowSteps(input.body.steps) : null;
  return prisma.$transaction(async (tx) => {
    if (steps) {
      await tx.hrWorkflowStep.deleteMany({ where: { workflowId: input.body.id } });
    }

    const workflow = await tx.hrWorkflow.update({
      where: { id: input.body.id },
      data: {
        name: input.body.name,
        description: input.body.description,
        active: input.body.active,
        rejectionRule: input.body.rejectionRule,
        escalationEnabled: input.body.escalationEnabled,
        escalateAfterHours: numberOrNull(input.body.escalateAfterHours),
        escalateTo: input.body.escalateTo,
        steps: steps ? { create: steps } : undefined,
      },
      include: { steps: { orderBy: { stepNumber: "asc" } } },
    });

    await tx.hrActivityLog.create({
      data: {
        module: "workflow",
        action: "updated",
        actorId: input.actorId,
        entityType: "HrWorkflow",
        entityId: workflow.id,
        newValue: stringifyJson(workflow),
      },
    });
    return workflow;
  });
}

async function createCandidateProcess(body: any) {
  const candidate = await prisma.hrCandidate.findUnique({ where: { id: body.candidateId } });
  const hiringRequest = body.hiringRequestId
    ? await prisma.recruitmentRequest.findUnique({ where: { id: body.hiringRequestId } })
    : null;
  const requiredSkills = splitList(body.requiredSkills);
  const match = candidate
    ? candidateMatchScore(
        {
          jobTitle: candidate.currentPosition,
          department: body.departmentName || hiringRequest?.departmentName,
          skills: parseMaybeJson(candidate.skillsJson, []),
          yearsOfExperience: candidate.yearsOfExperience,
          expectedSalary: candidate.expectedSalary,
          city: candidate.city,
          previousInterviewScore: numberOrNull(body.previousInterviewScore),
        },
        {
          positionTitle: body.positionTitle || hiringRequest?.positionTitle,
          department: body.departmentName || hiringRequest?.departmentName,
          requiredSkills,
          minExperience: Number(body.minExperience) || 0,
          maxSalary: numberOrNull(body.maxSalary),
          city: body.city || null,
        }
      )
    : { score: 0 };

  return prisma.hrCandidateProcess.create({
    data: {
      candidateId: body.candidateId,
      hiringRequestId: body.hiringRequestId || null,
      departmentName: body.departmentName || hiringRequest?.departmentName || null,
      positionTitle: clean(body.positionTitle || hiringRequest?.positionTitle),
      status: body.status || "applied",
      recruiterId: body.recruiterId || null,
      matchScore: match.score,
      timeline: { create: { action: "process_started", notes: stringifyJson(match) } },
    },
  });
}

async function createInterviewFeedback(input: { actorId: string; body: any }) {
  const scores = [
    Number(input.body.technicalSkills) || 0,
    Number(input.body.communication) || 0,
    Number(input.body.problemSolving) || 0,
    Number(input.body.professionalism) || 0,
    Number(input.body.cultureFit) || 0,
    Number(input.body.confidence) || 0,
    Number(input.body.relevantExperience) || 0,
  ];
  const averageScore = round2(scores.reduce((sum, score) => sum + score, 0) / scores.length);

  return prisma.hrInterviewFeedback.upsert({
    where: { interviewId: input.body.interviewId },
    update: {
      technicalSkills: scores[0],
      communication: scores[1],
      problemSolving: scores[2],
      professionalism: scores[3],
      cultureFit: scores[4],
      confidence: scores[5],
      relevantExperience: scores[6],
      averageScore,
      percentage: round2(averageScore * 10),
      recommendation: input.body.recommendation || "hold",
      comments: input.body.comments || null,
      submittedById: input.actorId,
    },
    create: {
      interviewId: input.body.interviewId,
      technicalSkills: scores[0],
      communication: scores[1],
      problemSolving: scores[2],
      professionalism: scores[3],
      cultureFit: scores[4],
      confidence: scores[5],
      relevantExperience: scores[6],
      averageScore,
      percentage: round2(averageScore * 10),
      recommendation: input.body.recommendation || "hold",
      comments: input.body.comments || null,
      submittedById: input.actorId,
    },
  });
}

async function createSalaryChange(input: { actorId: string; body: any }) {
  const record = await prisma.hrRecord.findUnique({ where: { userId: input.body.userId } });
  const currentSalary = Number(input.body.currentSalary ?? record?.currentSalary ?? record?.baseSalary ?? 0);
  const proposedSalary = Number(input.body.proposedSalary) || currentSalary;
  const metrics = salaryChangeMetrics(currentSalary, proposedSalary);

  return prisma.hrSalaryChangeRequest.create({
    data: {
      userId: input.body.userId,
      changeType: input.body.changeType || "annual_review",
      effectiveDate: toDateOrNow(input.body.effectiveDate),
      currentSalary,
      proposedSalary,
      differenceAmount: metrics.differenceAmount,
      differencePercentage: metrics.differencePercentage,
      reason: clean(input.body.reason),
      notes: input.body.notes || null,
      attachmentUrl: input.body.attachmentUrl || null,
      status: input.body.status || "pending",
      createdById: input.actorId,
    },
  });
}

async function updateSalaryChange(input: { actorId: string; body: any }) {
  const salaryChange = await prisma.hrSalaryChangeRequest.findUnique({ where: { id: input.body.id } });
  if (!salaryChange) return { status: "missing_id" as const };

  if (input.body.status !== "approved") {
    return prisma.hrSalaryChangeRequest.update({
      where: { id: input.body.id },
      data: {
        status: input.body.status,
        rejectedReason: input.body.rejectedReason,
      },
    });
  }

  return prisma.$transaction(async (tx) => {
    const approved = await tx.hrSalaryChangeRequest.update({
      where: { id: input.body.id },
      data: { status: "approved", approvedById: input.actorId, approvedAt: new Date() },
    });
    await tx.hrRecord.updateMany({
      where: { userId: approved.userId },
      data: { currentSalary: approved.proposedSalary, baseSalary: approved.proposedSalary },
    });
    await tx.salaryHistory.create({
      data: {
        userId: approved.userId,
        effectiveDate: approved.effectiveDate,
        previousSalary: approved.currentSalary,
        newSalary: approved.proposedSalary,
        increaseAmount: approved.differenceAmount,
        increasePct: approved.differencePercentage,
        changeType: approved.changeType,
        reviewStatus: "completed",
        notes: approved.reason,
      },
    });
    await tx.hrActivityLog.create({
      data: {
        module: "compensation",
        action: "salary_change_approved",
        actorId: input.actorId,
        employeeId: approved.userId,
        entityType: "HrSalaryChangeRequest",
        entityId: approved.id,
        newValue: stringifyJson(approved),
      },
    });
    return approved;
  });
}

async function updatePromotion(input: { actorId: string; body: any }) {
  const promotion = await prisma.hrPromotion.findUnique({ where: { id: input.body.id } });
  if (!promotion) return { status: "missing_id" as const };

  if (input.body.status !== "approved") {
    return prisma.hrPromotion.update({ where: { id: input.body.id }, data: { status: input.body.status } });
  }

  return prisma.$transaction(async (tx) => {
    const approved = await tx.hrPromotion.update({
      where: { id: input.body.id },
      data: { status: "approved", approvedById: input.actorId, approvedAt: new Date() },
    });
    await tx.hrRecord.updateMany({
      where: { userId: approved.userId },
      data: {
        department: approved.newDepartment || undefined,
        jobTitle: approved.newJobPosition || undefined,
        currentSalary: approved.newSalary ?? undefined,
        baseSalary: approved.newSalary ?? undefined,
      },
    });
    await tx.hrActivityLog.create({
      data: {
        module: "compensation",
        action: "promotion_approved",
        actorId: input.actorId,
        employeeId: approved.userId,
        entityType: "HrPromotion",
        entityId: approved.id,
        newValue: stringifyJson(approved),
      },
    });
    return approved;
  });
}

async function decideAttendanceAdjustment(input: { actorId: string; body: any }) {
  const adjustment = await prisma.hrAttendanceAdjustment.update({
    where: { id: input.body.id },
    data: {
      status: input.body.status,
      hrNotes: input.body.hrNotes || null,
      approvedById: input.actorId,
      decisionDate: new Date(),
    },
  });

  if (input.body.status !== "approved") {
    return adjustment;
  }

  const attendanceDate = new Date(adjustment.requestDate);
  attendanceDate.setHours(0, 0, 0, 0);
  const updateData = attendanceUpdateForAdjustment(adjustment.adjustmentType, adjustment.correctTime);
  await prisma.attendance.upsert({
    where: { id: input.body.attendanceId || "__missing_attendance__" },
    update: updateData,
    create: {
      userId: adjustment.userId,
      date: attendanceDate,
      ...updateData,
    },
  });
  return adjustment;
}

function attendanceUpdateForAdjustment(adjustmentType: string, correctTime: Date) {
  const type = adjustmentType.toLowerCase();
  if (type.includes("check-out") || type.includes("checkout")) {
    return { checkOut: correctTime, status: "corrected" };
  }
  return { checkIn: correctTime, status: "corrected" };
}

async function logHrmActivity(input: {
  actorId: string;
  module: string;
  action: string;
  entityType?: string;
  entityId?: string;
  employeeId?: string;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  return prisma.hrActivityLog.create({
    data: {
      module: input.module,
      action: input.action,
      actorId: input.actorId,
      employeeId: input.employeeId || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      previousValue: input.previousValue === undefined ? null : stringifyJson(input.previousValue),
      newValue: input.newValue === undefined ? null : stringifyJson(input.newValue),
    },
  });
}

function normalizeWorkflowSteps(raw: any) {
  const parsed = typeof raw === "string" ? safeJson(raw, []) : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((step, index) => ({
      stepNumber: Number(step.stepNumber) || index + 1,
      name: clean(step.name || `Step ${index + 1}`),
      approverType: step.approverType || "hr_manager",
      approverValue: step.approverValue || null,
      required: step.required !== false,
      mode: step.mode || "sequential",
      autoApprove: Boolean(step.autoApprove),
      skipWhen: step.skipWhen || null,
      notifications: stringifyJson(step.notifications || {}),
      escalationHours: numberOrNull(step.escalationHours),
      escalateTo: step.escalateTo || null,
    }))
    .filter((step) => step.name);
}

async function nextHrRequestNumber(tx: any) {
  const year = new Date().getFullYear();
  const count = await tx.hrRequest.count({
    where: {
      requestNumber: {
        startsWith: `HR-${year}-`,
      },
    },
  });
  return `HR-${year}-${String(count + 1).padStart(5, "0")}`;
}

function parseMaybeJson<T>(raw: unknown, fallback: T): T {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function splitList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function numberOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugify(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

async function generatePayrollPeriod(input: {
  actorId: string;
  month: string;
  notes?: string | null;
  bonusSubmissionDeadline?: string | null;
}) {
  const month = input.month && /^\d{4}-\d{2}$/.test(input.month) ? input.month : currentMonth();
  const { start, end } = monthRange(month);
  const existing = await prisma.hrPayrollPeriod.findUnique({ where: { month } });
  if (existing && ["Published", "Locked"].includes(existing.status)) {
    return { status: "locked_period" as const };
  }

  const employees = await prisma.user.findMany({
    where: { status: "Active" },
    include: { hrRecord: true },
    orderBy: { name: "asc" },
  });

  const [attendanceRows, leaveRows, commissionRows, warningRows] = await Promise.all([
    prisma.attendance.findMany({ where: { date: { gte: start, lt: end } } }),
    prisma.leaveRequest.findMany({ where: { status: "Approved", date: { gte: start, lt: end } } }),
    prisma.commission.findMany({ where: { month } }),
    prisma.hrWarning.findMany({ where: { date: { gte: start, lt: end } } }),
  ]);

  const commissions = new Map(commissionRows.map((row) => [row.userId, row]));
  const period = await prisma.hrPayrollPeriod.upsert({
    where: { month },
    update: {
      status: "Draft",
      generatedById: input.actorId,
      generatedAt: new Date(),
      notes: input.notes || null,
      bonusSubmissionDeadline: toDateOrNull(input.bonusSubmissionDeadline),
    },
    create: {
      month,
      status: "Draft",
      generatedById: input.actorId,
      generatedAt: new Date(),
      notes: input.notes || null,
      bonusSubmissionDeadline: toDateOrNull(input.bonusSubmissionDeadline),
    },
  });

  await prisma.hrPayrollEntry.deleteMany({ where: { periodId: period.id } });

  const entries = employees.map((employee) => {
    const hr = employee.hrRecord;
    const attendance = attendanceRows.filter((row) => row.userId === employee.id);
    const leaves = leaveRows.filter((row) => row.userId === employee.id);
    const warnings = warningRows.filter((row) => row.userId === employee.id);
    const commission = commissions.get(employee.id);

    const baseSalary = hr?.currentSalary ?? hr?.baseSalary ?? 0;
    const allowances = hr?.allowances ?? 0;
    const workingHoursPerDay = hr?.workingHoursPerDay ?? 8;
    const hourlyRate = baseSalary > 0 ? baseSalary / WORKING_DAYS_PER_MONTH / workingHoursPerDay : 0;
    const dailyRate = baseSalary > 0 ? baseSalary / WORKING_DAYS_PER_MONTH : 0;
    const unexcusedAbsenceDays = attendance.filter((row) => row.status === "unexcused_absence").length;
    const totalDeductionHours = attendance.reduce(
      (sum, row) => sum + (row.deductionHours || deductionHoursFromAttendance(row)),
      0
    );
    const warningDeduction = warnings.reduce((sum, row) => sum + row.payrollDeduction, 0);
    const attendanceDeduction = round2(totalDeductionHours * hourlyRate);
    const absenceDeduction = round2(unexcusedAbsenceDays * dailyRate * 2);
    const commissionAmount = commission?.commissionAmount || 0;
    const bonus = sumLineItems(commission?.bonuses ?? null);
    const netSalary = round2(
      baseSalary + allowances + bonus + commissionAmount - attendanceDeduction - absenceDeduction - warningDeduction
    );

    return {
      periodId: period.id,
      userId: employee.id,
      employeeCode: hr?.employeeCode || null,
      employeeName: employee.name,
      department: hr?.department || roleDepartment(employee.role),
      position: hr?.jobTitle || employee.role.replace(/_/g, " "),
      fingerprintCode: hr?.fingerprintCode || null,
      baseSalary,
      allowances,
      hourlyRate: round2(hourlyRate),
      workingHoursPerDay,
      workingDays: WORKING_DAYS_PER_MONTH,
      daysPresent: attendance.filter((row) => row.checkIn).length,
      daysAbsent: attendance.filter((row) => row.status === "absent").length,
      unexcusedAbsenceDays,
      lateArrivals: attendance.filter((row) => row.lateMinutes > 18).length,
      earlyLeaves: attendance.filter((row) => row.earlyLeaveMinutes > 0).length,
      approvedLeaveDays: leaves.filter((row) => row.type === "Leave" || row.type === "annual").reduce((sum, row) => sum + (row.days || 1), 0),
      approvedRemoteDays: leaves.filter((row) => row.type === "Remote").length,
      approvedPermissionHours: leaves
        .filter((row) => row.type === "Permission")
        .reduce((sum, row) => sum + hoursFromDuration(row.duration), 0),
      totalDeductionHours,
      attendanceDeduction,
      absenceDeduction,
      warningDeduction,
      commission: commissionAmount,
      bonus,
      achievementPct:
        hr?.monthlyTarget && hr.monthlyTarget > 0 ? round2(((commission?.netTarget || 0) / hr.monthlyTarget) * 100) : 0,
      netSalary,
    };
  });

  if (entries.length) {
    await prisma.hrPayrollEntry.createMany({ data: entries });
  }

  return prisma.hrPayrollPeriod.findUnique({
    where: { id: period.id },
    include: { entries: { orderBy: { employeeName: "asc" } } },
  });
}

async function updatePayrollStatus(input: {
  actorId: string;
  id: string;
  status: string;
  reason?: string | null;
}) {
  const now = new Date();
  const data: any = { status: input.status };
  if (input.status === "Pending review") data.generatedAt = now;
  if (input.status === "Approved") {
    data.approvedById = input.actorId;
    data.approvedAt = now;
  }
  if (input.status === "Published") {
    data.publishedById = input.actorId;
    data.publishedAt = now;
  }
  if (input.status === "Locked") {
    data.lockedById = input.actorId;
    data.lockedAt = now;
  }
  if (input.status === "Reopened") {
    data.reopenedById = input.actorId;
    data.reopenedAt = now;
    data.reopenedReason = input.reason || "Correction requested";
  }
  return prisma.hrPayrollPeriod.update({ where: { id: input.id }, data, include: { entries: true } });
}

async function updateSalaryAdvance(input: {
  actorId: string;
  id: string;
  status: string;
  rejectionReason?: string | null;
}) {
  const now = new Date();
  const data: any = { status: input.status };
  if (input.status === "pending_accountant") {
    data.deptHeadApprovedById = input.actorId;
    data.deptHeadApprovedAt = now;
  }
  if (input.status === "approved") {
    data.accountantApprovedById = input.actorId;
    data.accountantApprovedAt = now;
  }
  if (input.status === "paid") data.paidAt = now;
  if (input.status === "rejected") data.rejectionReason = input.rejectionReason || "Rejected";
  return prisma.salaryAdvance.update({ where: { id: input.id }, data });
}

async function salaryAdvanceEligibility(userId: string, amount: number) {
  const record = await prisma.hrRecord.findUnique({ where: { userId } });
  if (!record) return { ok: false, reason: "Employee has no HR record" };
  const hiringDate = record.hiringDate;
  if (hiringDate) {
    const serviceDays = Math.floor((Date.now() - hiringDate.getTime()) / 86400000);
    if (serviceDays < 90) return { ok: false, reason: "Minimum service is 3 months" };
  }
  const baseSalary = record.currentSalary || record.baseSalary || 0;
  if (amount > baseSalary * 0.5) return { ok: false, reason: "Advance cannot exceed 50% of basic salary" };
  return { ok: true };
}

function normalizeKpiItems(raw: any): { name: string; weight: number; description?: string | null }[] {
  const parsed = typeof raw === "string" ? safeJson(raw, []) : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => ({
      name: clean(item.name),
      weight: Number(item.weight) || 0,
      description: item.description || null,
    }))
    .filter((item) => item.name && item.weight > 0);
}

function deductionHoursFromAttendance(row: { lateMinutes: number; earlyLeaveMinutes: number }) {
  let hours = 0;
  if (row.lateMinutes >= 19 && row.lateMinutes <= 35) hours += 2;
  else if (row.lateMinutes >= 36 && row.lateMinutes <= 90) hours += 4;
  else if (row.lateMinutes > 90) hours += 6;
  if (row.earlyLeaveMinutes >= 60) hours += 4;
  return hours;
}

function hoursFromDuration(duration?: string | null) {
  const match = String(duration || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) || 0 : 0;
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function toDateOrNow(value: unknown) {
  return value ? new Date(String(value)) : new Date();
}

function toDateOrNull(value: unknown) {
  return value ? new Date(String(value)) : null;
}

function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function roleDepartment(role?: string | null) {
  const value = String(role || "");
  if (value.includes("sales") && !value.includes("tele")) return "Sales";
  if (value.includes("tele")) return "TeleSales";
  if (value.includes("account")) return "Account Management";
  if (value.includes("seo")) return "SEO";
  if (value.includes("media")) return "Media Buying";
  if (value.includes("social")) return "Social Media";
  if (value.includes("graphic") || value.includes("motion") || value.includes("ui")) return "Design";
  if (value.includes("hr")) return "HR";
  if (value.includes("accountant")) return "Finance";
  if (value.includes("technical")) return "Technical";
  return "Administration";
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
