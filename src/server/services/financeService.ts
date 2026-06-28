import {
  buildCommissionBreakdownForUserMonth,
  loadCommissionConfig,
  recomputeMonth,
  recomputeTelesalesBonuses,
  sumLineItems,
} from "@/lib/commissions";
import { computePayslip, monthRange } from "@/lib/payslip";
import * as XLSX from "xlsx";
import {
  aggregateFinanceApprovedDeductionsByUser,
  findCommissionsByMonth,
  findCommissionForEdit,
  findCommissionsForExport,
  findFinanceOverviewDeals,
  findFinancePayrollCommissions,
  findFinancePayrollHrRecords,
  findInstallmentForUpdate,
  findPendingInstallments,
  updateCommission,
  updateInstallmentPaidWithLog,
} from "@/server/repositories/financeRepository";

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
