import {
  buildCommissionBreakdownForUserMonth,
  loadCommissionConfig,
  recomputeMonth,
  recomputeTelesalesBonuses,
  sumLineItems,
  COMMISSION_PARAMS_KEY,
  COMMISSION_RATE_KEYS,
  DEFAULT_COMMISSION_PARAMS,
} from "@/lib/commissions";
import { computePayslip, monthRange } from "@/lib/payslip";
import { safeTrigger } from "@/lib/pusher";
import * as XLSX from "xlsx";
import {
  aggregateFinanceApprovedDeductionsByUser,
  createReminderNotification,
  findActiveAccountant,
  findCommissionsByMonth,
  findCommissionForEdit,
  findCommissionsForExport,
  findFinanceOverviewDeals,
  findFinancePayrollCommissions,
  findFinancePayrollHrRecords,
  findInstallmentForUpdate,
  findPendingInstallments,
  findRecentNotificationMatch,
  findUnpaidInstallmentsWithDeal,
  updateCommission,
  updateInstallmentPaidWithLog,
} from "@/server/repositories/financeRepository";
import { upsertSystemConfig } from "@/server/repositories/settingsRepository";

export async function getFinanceOverview() {
  const deals = await findFinanceOverviewDeals();

  const totalRevenue = deals.reduce((sum, deal) => sum + deal.totalAmount, 0);
  const totalCollected = deals.reduce((sum, deal) => {
    const collectedInstallments = deal.installments
      .filter((installment) => installment.isPaid)
      .reduce((instSum, installment) => instSum + installment.amount, 0);
    const collected = (deal.firstAmount || 0) + collectedInstallments;
    return sum + collected;
  }, 0);

  const pendingInstallments = await findPendingInstallments();
  const upcomingAmounts = pendingInstallments.reduce((sum, installment) => sum + installment.amount, 0);

  return {
    overview: {
      totalRevenue,
      totalCollected,
      totalRemaining: totalRevenue - totalCollected,
      upcomingAmounts,
      dealsCount: deals.length,
    },
    deals,
    pendingInstallments,
  };
}

export function getDefaultCommissionMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function listCommissions(month: string) {
  const commissions = await findCommissionsByMonth(month);
  const config = await loadCommissionConfig();
  const withBreakdown = await Promise.all(
    commissions.map(async (commission) => ({
      ...commission,
      breakdown: await buildCommissionBreakdownForUserMonth({
        userId: commission.userId,
        role: commission.user.role,
        month,
      }),
    }))
  );

  return { commissions: withBreakdown, month, config };
}

export async function recomputeCommissions(month: string) {
  const [salesResults, telesalesResults] = await Promise.all([
    recomputeMonth(month),
    recomputeTelesalesBonuses(month),
  ]);

  return {
    success: true,
    count: salesResults.length + telesalesResults.length,
    salesCount: salesResults.length,
    telesalesCount: telesalesResults.length,
  };
}

export async function editCommission(input: { id: string; body: any }) {
  const existing = await findCommissionForEdit(input.id);
  if (!existing) return { status: "not_found" as const };

  if (existing.finalized && (input.body.bonuses !== undefined || input.body.deductions !== undefined)) {
    return { status: "finalized_locked" as const };
  }

  const data: any = {};
  if (Array.isArray(input.body.bonuses)) data.bonuses = JSON.stringify(input.body.bonuses);
  if (Array.isArray(input.body.deductions)) data.deductions = JSON.stringify(input.body.deductions);
  if (input.body.finalized === true) data.finalized = true;

  if (data.bonuses !== undefined || data.deductions !== undefined) {
    const baseSalary = existing.user.hrRecord?.baseSalary || 0;
    const bonusesSum = sumLineItems(data.bonuses ?? existing.bonuses);
    const deductionsSum = sumLineItems(data.deductions ?? existing.deductions);
    data.netPayout =
      Math.round((baseSalary + existing.commissionAmount + bonusesSum - deductionsSum) * 100) / 100;
  }

  if (Object.keys(data).length === 0) {
    return { status: "no_fields" as const };
  }

  const commission = await updateCommission(input.id, data);
  return { status: "ok" as const, commission };
}

export async function updateInstallmentPayment(input: { id: string; userId: string; body: any }) {
  const { isPaid } = input.body;
  if (typeof isPaid !== "boolean") {
    return { status: "invalid_is_paid" as const };
  }

  const existing = await findInstallmentForUpdate(input.id);
  if (!existing) return { status: "not_found" as const };

  const installment = await updateInstallmentPaidWithLog({
    id: input.id,
    isPaid,
    userId: input.userId,
    projectId: existing.deal.projects[0]?.id,
    amount: existing.amount,
  });

  return { status: "ok" as const, installment };
}

export async function buildCommissionsExport(month: string) {
  const commissions = await findCommissionsForExport(month);

  const rows = await Promise.all(
    commissions.map(async (commission) => {
      const breakdown = await buildCommissionBreakdownForUserMonth({
        userId: commission.user.id,
        role: commission.user.role,
        month,
      });
      return {
        Employee: commission.user.name,
        Email: commission.user.email,
        Role: commission.user.role,
        Level: commission.user.level || "",
        Plan: breakdown?.planLabel || "",
        "Base Salary (SAR)": commission.user.hrRecord?.baseSalary || 0,
        "Monthly Target": commission.user.hrRecord?.monthlyTarget || 0,
        "Gross Fund (SAR)": breakdown?.grossFund ?? 0,
        "Gateway Fees (SAR)": breakdown?.gatewayFees ?? 0,
        "Net Commission Base (SAR)": commission.netTarget,
        Tier: breakdown?.tierLabel || "",
        "Tier %": breakdown ? Math.round(breakdown.tierPct * 10000) / 100 : 0,
        "Commission %": Math.round(commission.commissionPct * 10000) / 100,
        "Commission Amount (SAR)": commission.commissionAmount,
        "Auto/Manual Bonuses (SAR)": sumLineItems(commission.bonuses),
        "Deductions (SAR)": sumLineItems(commission.deductions),
        "Net Payout (SAR)": commission.netPayout,
        Finalized: commission.finalized ? "Yes" : "No",
      };
    })
  );

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, `Commissions ${month}`);

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export async function listFinancePayroll(month: string) {
  const { start, end } = monthRange(month);
  const [records, deductionsByUser, commissionRows] = await Promise.all([
    findFinancePayrollHrRecords(),
    aggregateFinanceApprovedDeductionsByUser(start, end),
    findFinancePayrollCommissions(month),
  ]);

  const commissionByUser = new Map(commissionRows.map((row) => [row.userId, row]));
  const rows = records.map((record) => {
    const commission = commissionByUser.get(record.userId);
    const commissionAmount = commission?.commissionAmount || 0;
    const commissionBonuses = sumLineItems(commission?.bonuses ?? null);
    const commissionDeductions = sumLineItems(commission?.deductions ?? null);
    const attendanceDeductions = deductionsByUser.get(record.userId) || 0;
    const payslip = computePayslip({
      baseSalary: record.baseSalary,
      bonuses: commissionAmount + commissionBonuses,
      deductions: commissionDeductions + attendanceDeductions,
    });

    return {
      userId: record.userId,
      name: record.user.name,
      email: record.user.email,
      role: record.user.role,
      level: record.user.level,
      status: record.user.status,
      baseSalary: payslip.baseSalary,
      commissionAmount,
      bonuses: commissionBonuses,
      attendanceDeductions,
      commissionDeductions,
      deductions: payslip.deductions,
      net: payslip.net,
      finalized: commission?.finalized ?? false,
    };
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));

  const totals = rows.reduce(
    (acc, row) => ({
      baseSalary: acc.baseSalary + row.baseSalary,
      commissionAmount: acc.commissionAmount + row.commissionAmount,
      bonuses: acc.bonuses + row.bonuses,
      deductions: acc.deductions + row.deductions,
      net: acc.net + row.net,
    }),
    { baseSalary: 0, commissionAmount: 0, bonuses: 0, deductions: 0, net: 0 }
  );

  return { month, rows, totals };
}

// ── Commission config editing (accountant/super_admin) ──

const COMMISSION_RATE_KEY_SET = new Set<string>(Object.values(COMMISSION_RATE_KEYS));

function isValidCommissionParams(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    // Every provided key must be a known param and a finite number.
    return Object.entries(parsed).every(
      ([key, v]) => key in DEFAULT_COMMISSION_PARAMS && Number.isFinite(Number(v))
    );
  } catch {
    return false;
  }
}

function isValidRateTable(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    return parsed.every(
      (tier) =>
        tier &&
        typeof tier === "object" &&
        Number.isFinite(Number(tier.min)) &&
        Number.isFinite(Number(tier.pct)) &&
        Number(tier.pct) >= 0 &&
        Number(tier.pct) <= 1 &&
        (tier.max === null || tier.max === undefined || tier.max === "" || Number.isFinite(Number(tier.max)))
    );
  } catch {
    return false;
  }
}

/**
 * Persists a commission rate table / formula params / gateway fee to
 * SystemConfig and immediately recomputes the current month so payouts
 * reflect the new rates.
 */
export async function updateCommissionConfig(input: { adminId: string; key: any; value: any }) {
  const key = typeof input.key === "string" ? input.key : "";
  const value = typeof input.value === "string" ? input.value : "";
  if (!key || !value) return { status: "missing_fields" as const };

  if (COMMISSION_RATE_KEY_SET.has(key)) {
    if (!isValidRateTable(value)) {
      return {
        status: "invalid_value" as const,
        message: "Rate table must be a JSON array of { min, max, pct }, with pct between 0 and 1",
      };
    }
  } else if (key === COMMISSION_PARAMS_KEY) {
    if (!isValidCommissionParams(value)) {
      return {
        status: "invalid_value" as const,
        message: "Formula parameters must be a JSON object of known numeric keys",
      };
    }
  } else if (key === "gateway_fee_pct") {
    const fee = parseFloat(value);
    if (Number.isNaN(fee) || fee < 0 || fee >= 1) {
      return { status: "invalid_value" as const, message: "gateway_fee_pct must be a decimal between 0 and 1" };
    }
  } else {
    return { status: "invalid_value" as const, message: "Unsupported commission config key" };
  }

  await upsertSystemConfig({ key, value, updatedById: input.adminId });

  const month = new Date().toISOString().slice(0, 7);
  let recomputed = false;
  try {
    await Promise.all([recomputeMonth(month), recomputeTelesalesBonuses(month)]);
    recomputed = true;
    await safeTrigger("finance-channel", "config-updated", { key, month });
  } catch (e) {
    console.error("Recompute after commission-config change failed:", e);
  }

  return { status: "ok" as const, recomputed };
}

// ── Daily installment payment reminders (cron) ──

async function createNotificationOnce(
  data: {
    userId: string;
    title: string;
    message: string;
    type: string;
    link: string;
    relatedId: string;
  },
  since: Date
) {
  const existing = await findRecentNotificationMatch({
    userId: data.userId,
    type: data.type,
    relatedId: data.relatedId,
    title: data.title,
    since,
  });
  if (existing) return false;
  await createReminderNotification(data);
  return true;
}

/** Intended to run daily: reminds sales agents and the accountant about
 * upcoming and overdue unpaid installments (deduplicated per day). */
export async function sendInstallmentReminders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const intervals = [15, 10, 5, 1]; // Reminder milestone days (before due)
  const overdueIntervals = [1, 3, 7, 15]; // Overdue milestone days (after due)

  const installments = await findUnpaidInstallmentsWithDeal();

  let notificationsCreated = 0;

  for (const inst of installments) {
    const dueDate = new Date(inst.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (intervals.includes(diffDays) || diffDays === 0) {
      // Notify Sales Agent
      const createdSalesReminder = await createNotificationOnce(
        {
          userId: inst.deal.salesAgentId,
          title: `Payment Reminder: ${diffDays === 0 ? "DUE TODAY" : `${diffDays} days left`}`,
          message: `Installment of SAR ${inst.amount} is due ${diffDays === 0 ? "TODAY" : `in ${diffDays} days`}.`,
          type: "payment_reminder",
          link: "/dashboard/sales",
          relatedId: inst.id,
        },
        today
      );
      if (createdSalesReminder) notificationsCreated++;

      // Notify Accountant
      const accountant = await findActiveAccountant();
      if (accountant) {
        const createdAccountantReminder = await createNotificationOnce(
          {
            userId: accountant.id,
            title: `Payment Follow-up: ${diffDays === 0 ? "DUE TODAY" : `${diffDays} days left`}`,
            message: `An installment of SAR ${inst.amount} is set to be paid ${diffDays === 0 ? "TODAY" : `in ${diffDays} days`}.`,
            type: "payment_reminder",
            link: "/dashboard/finance",
            relatedId: inst.id,
          },
          today
        );
        if (createdAccountantReminder) notificationsCreated++;
      }
    } else if (diffDays < 0 && overdueIntervals.includes(Math.abs(diffDays))) {
      // Overdue: installment past its due date — alert the agent + accountant.
      const daysOverdue = Math.abs(diffDays);
      const createdSalesOverdue = await createNotificationOnce(
        {
          userId: inst.deal.salesAgentId,
          title: `Payment OVERDUE: ${daysOverdue} days`,
          message: `Installment of SAR ${inst.amount} is overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}.`,
          type: "payment_overdue",
          link: "/dashboard/sales",
          relatedId: inst.id,
        },
        today
      );
      if (createdSalesOverdue) notificationsCreated++;

      const overdueAccountant = await findActiveAccountant();
      if (overdueAccountant) {
        const createdAccountantOverdue = await createNotificationOnce(
          {
            userId: overdueAccountant.id,
            title: `Payment OVERDUE: ${daysOverdue} days`,
            message: `Installment of SAR ${inst.amount} is overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}.`,
            type: "payment_overdue",
            link: "/dashboard/finance",
            relatedId: inst.id,
          },
          today
        );
        if (createdAccountantOverdue) notificationsCreated++;
      }
    }
  }

  return { processedInstallments: installments.length, notificationsCreated };
}
