import { findFinanceOverviewDeals, findPendingInstallments } from "@/server/repositories/financeRepository";

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
