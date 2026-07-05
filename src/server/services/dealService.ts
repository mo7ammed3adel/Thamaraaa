import { safeTrigger } from "@/lib/pusher";
import { normalizeWebUrl } from "@/lib/safe-url";
import { notifyHeadAccountManagersOfNewProject } from "@/lib/projectSetup";
import {
  createDealClosedNotification,
  createDealWithProject,
  findClosedWonDealsForList,
  findDealCloserForManagerNotification,
  findDealLead,
  findGatewayFeeConfig,
} from "@/server/repositories/dealRepository";

export async function createClosedDeal(input: {
  userId: string;
  userRole: string;
  body: any;
}) {
  const {
    leadId,
    packageType,
    contractStart,
    contractEnd,
    totalAmount,
    firstAmount,
    paymentMethod,
    paymentBreakdown,
    installments,
    contractImageUrl,
    receiptUrl,
  } = input.body;

  if (!leadId || !packageType || !totalAmount) {
    return { status: "missing_required" as const };
  }

  if (parseFloat(totalAmount) < 0) {
    return { status: "negative_total" as const };
  }

  const safeContractImageUrl = contractImageUrl ? normalizeWebUrl(contractImageUrl) : null;
  const safeReceiptUrl = receiptUrl ? normalizeWebUrl(receiptUrl) : null;
  if ((contractImageUrl && !safeContractImageUrl) || (receiptUrl && !safeReceiptUrl)) {
    return { status: "invalid_urls" as const };
  }

  const lead = await findDealLead(leadId);
  if (!lead) {
    return { status: "lead_not_found" as const };
  }

  if (
    lead.assignedSalesAgentId !== input.userId &&
    input.userRole !== "super_admin" &&
    input.userRole !== "sales_manager"
  ) {
    return { status: "forbidden" as const };
  }

  const gatewayFeeConfig = await findGatewayFeeConfig();
  const gatewayFee = gatewayFeeConfig ? parseFloat(gatewayFeeConfig.value) : 0.07;

  // Normalize an optional split-payment breakdown. Each entry pairs a method
  // with the amount paid through it; only the Tabby/Tamara portions incur the
  // gateway fee, so a split deal can lose less to fees than a fully-gateway one.
  let normalizedBreakdown:
    | { method: string; amount: number }[]
    | null = null;
  if (Array.isArray(paymentBreakdown) && paymentBreakdown.length > 0) {
    normalizedBreakdown = paymentBreakdown
      .map((entry: any) => ({
        method: String(entry?.method || "").trim(),
        amount: parseFloat(entry?.amount),
      }))
      .filter((entry) => entry.method && Number.isFinite(entry.amount) && entry.amount > 0);
    if (normalizedBreakdown.length === 0) normalizedBreakdown = null;
  }

  const total = parseFloat(totalAmount);
  let netTarget = total;
  if (normalizedBreakdown) {
    // Apply the gateway fee only to the Tabby/Tamara share of the contract.
    const gatewayAmount = normalizedBreakdown
      .filter((entry) => entry.method === "Tabby" || entry.method === "Tamara")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const feeableShare = total > 0 ? Math.min(gatewayAmount, total) : 0;
    netTarget = total - feeableShare * gatewayFee;
  } else if (paymentMethod === "Tabby" || paymentMethod === "Tamara") {
    netTarget = total * (1 - gatewayFee);
  }

  const { deal } = await createDealWithProject({
    lead,
    leadId,
    salesAgentId: input.userId,
    packageType,
    contractStart,
    contractEnd,
    totalAmount: total,
    firstAmount: firstAmount ? parseFloat(firstAmount) : null,
    paymentMethod: normalizedBreakdown ? "Split" : paymentMethod,
    paymentBreakdown: normalizedBreakdown ? JSON.stringify(normalizedBreakdown) : null,
    netTarget,
    contractImageUrl: safeContractImageUrl,
    receiptUrl: safeReceiptUrl,
    installments,
  });

  await notifyHeadAccountManagersOfNewProject(lead.name, deal.package);

  const dbUser = await findDealCloserForManagerNotification(input.userId);
  if (dbUser?.directManagerId && process.env.PUSHER_APP_ID) {
    const managerLink = `/dashboard/sales/analytics`;
    const mgrMessage = `Agent ${dbUser.name} closed a new deal (${packageType}) for ${totalAmount} SAR.`;
    await createDealClosedNotification({
      managerId: dbUser.directManagerId,
      message: mgrMessage,
      link: managerLink,
    });
    await safeTrigger(`user-${dbUser.directManagerId}`, "new-notification", {
      title: "Deal Closed!",
      message: mgrMessage,
      link: managerLink,
    });
  }

  return { status: "ok" as const, deal };
}

export function buildDealsListWhereClause(user: { id: string; role: string }) {
  const whereClause: any = { status: "Closed_Won" };

  if (user.role === "tele_sales_agent") {
    whereClause.lead = { assignedTeleAgentId: user.id };
  } else if (user.role === "sales_agent") {
    whereClause.salesAgentId = user.id;
  } else if (user.role === "tele_sales_manager") {
    whereClause.lead = { teleAgent: { is: { directManagerId: user.id } } };
  } else if (user.role === "sales_manager") {
    whereClause.salesAgent = { is: { directManagerId: user.id } };
  }

  return whereClause;
}

export function listClosedDealsForUser(user: { id: string; role: string }) {
  return findClosedWonDealsForList(buildDealsListWhereClause(user));
}
