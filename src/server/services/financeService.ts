import { loadCommissionConfig, recomputeMonth, recomputeTelesalesBonuses } from "@/lib/commissions";
import {
  findCommissionsByMonth,
  findFinanceOverviewDeals,
  findPendingInstallments,
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
