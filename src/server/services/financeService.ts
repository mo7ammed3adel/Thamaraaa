import {
  loadCommissionConfig,
  recomputeMonth,
  recomputeTelesalesBonuses,
  sumLineItems,
} from "@/lib/commissions";
import {
  findCommissionsByMonth,
  findCommissionForEdit,
  findFinanceOverviewDeals,
  findPendingInstallments,
  updateCommission,
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
  return { commissions, month, config };
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
