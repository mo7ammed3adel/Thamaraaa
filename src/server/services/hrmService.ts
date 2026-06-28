import { prisma } from "@/lib/prisma";
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
  | "setting";

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
    settings,
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
    prisma.hrSystemSetting.findMany(),
  ]);

  const userNames = new Map(employees.map((employee) => [employee.id, employee.name]));
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
    kpiTemplates,
    exits: exits.map((exit) => ({ ...exit, employeeName: userNames.get(exit.userId) || "Unknown" })),
    complaints: complaints.map((complaint) => ({ ...complaint, employeeName: userNames.get(complaint.userId) || "Unknown" })),
    warnings: warnings.map((warning) => ({ ...warning, employeeName: userNames.get(warning.userId) || "Unknown" })),
    contracts: contracts.map((contract) => ({ ...contract, employeeName: userNames.get(contract.userId) || "Unknown" })),
    folders: folders.map((folder) => ({ ...folder, employeeName: userNames.get(folder.userId) || "Unknown" })),
    assets: assets.map((asset) => ({ ...asset, employeeName: userNames.get(asset.userId) || "Unknown" })),
    settings: settingsMap,
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

  if (resource === "setting") {
    return prisma.hrSystemSetting.upsert({
      where: { key: clean(body.key) },
      update: { value: String(body.value ?? ""), updatedById: actorId },
      create: { key: clean(body.key), value: String(body.value ?? ""), updatedById: actorId },
    });
  }

  return { status: "unknown_resource" as const };
}

export async function updateHrmResource(input: {
  actorId: string;
  resource: HrmResource;
  body: any;
}) {
  const { actorId, resource, body } = input;
  if (!body.id && resource !== "setting") return { status: "missing_id" as const };

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
    if (Array.isArray(body.items)) {
      const items = normalizeKpiItems(body.items);
      const total = items.reduce((sum, item) => sum + item.weight, 0);
      if (Math.round(total) !== 100) return { status: "invalid_weights" as const, total };
      return prisma.$transaction(async (tx) => {
        await tx.kpiItem.deleteMany({ where: { templateId: body.id } });
        return tx.kpiTemplate.update({
          where: { id: body.id },
          data: {
            name: body.name,
            active: body.active,
            targetRole: body.targetRole,
            items: { create: items },
          },
          include: { items: true },
        });
      });
    }
    return prisma.kpiTemplate.update({ where: { id: body.id }, data: { active: body.active } });
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

  if (resource === "setting") {
    return prisma.hrSystemSetting.upsert({
      where: { key: clean(body.key) },
      update: { value: String(body.value ?? ""), updatedById: actorId },
      create: { key: clean(body.key), value: String(body.value ?? ""), updatedById: actorId },
    });
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
  return { status: "delete_not_supported" as const };
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
