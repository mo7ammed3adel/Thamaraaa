import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { safeTrigger } from "@/lib/pusher";
import { normalizeWebUrl } from "@/lib/safe-url";
import {
  buildNewProjectData,
  projectSetupLogDetails,
  notifyHeadAccountManagersOfNewProject,
} from "@/lib/projectSetup";

/**
 * POST /api/deals
 * Creates a new deal when a Sales Agent closes a sale AND creates its Operations
 * project in the same transaction, so a closed deal can never be orphaned without
 * a project (spec §7, §22). Head Account Managers are notified to distribute it.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || (user.role !== "sales_agent" && user.role !== "super_admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await req.json();
    const { 
      leadId, packageType, contractStart, contractEnd, 
      totalAmount, firstAmount, paymentMethod, installments, 
      contractImageUrl, receiptUrl 
    } = data;

    if (!leadId || !packageType || !totalAmount) {
      return NextResponse.json({ error: "leadId, packageType, and totalAmount are required" }, { status: 400 });
    }

    if (parseFloat(totalAmount) < 0) {
      return NextResponse.json({ error: "Total amount cannot be negative" }, { status: 400 });
    }

    const safeContractImageUrl = contractImageUrl ? normalizeWebUrl(contractImageUrl) : null;
    const safeReceiptUrl = receiptUrl ? normalizeWebUrl(receiptUrl) : null;
    if ((contractImageUrl && !safeContractImageUrl) || (receiptUrl && !safeReceiptUrl)) {
      return NextResponse.json({ error: "Contract and receipt links must be valid http(s) URLs" }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.assignedSalesAgentId !== user.id && user.role !== "super_admin" && user.role !== "sales_manager") {
      return NextResponse.json({ error: "Forbidden: You are not assigned to this lead." }, { status: 403 });
    }

    // Fetch system configs for payment gateway fee
    const gatewayFeeConfig = await prisma.systemConfig.findUnique({ where: { key: "gateway_fee_pct" } });
    const gatewayFee = gatewayFeeConfig ? parseFloat(gatewayFeeConfig.value) : 0.07; // Default 7%

    let netTarget = parseFloat(totalAmount);
    if (paymentMethod === "Tabby" || paymentMethod === "Tamara") {
      netTarget = netTarget * (1 - gatewayFee);
    }

    // Deal + project are created together: if project creation fails, the deal is
    // rolled back too, guaranteeing no closed deal is left without a project.
    const { deal } = await prisma.$transaction(async (tx) => {
      const createdDeal = await tx.deal.create({
        data: {
          leadId,
          salesAgentId: user.id,
          package: packageType,
          contractStart: new Date(contractStart),
          contractEnd: new Date(contractEnd),
          totalAmount: parseFloat(totalAmount),
          firstAmount: firstAmount ? parseFloat(firstAmount) : null,
          paymentMethod,
          netTarget,
          contractImageUrl: safeContractImageUrl,
          receiptUrl: safeReceiptUrl,
          status: "Closed_Won",
          installments: installments && installments.length > 0 ? {
            create: installments.map((i: any) => ({
              amount: parseFloat(i.amount),
              dueDate: new Date(i.date),
              isPaid: false
            }))
          } : undefined
        }
      });

      // Update lead status to Closed_Won
      await tx.lead.update({
        where: { id: leadId },
        data: { status: "Closed_Won" }
      });

      // Create the Operations project (unassigned — Head AM will distribute it)
      const createdProject = await tx.project.create({
        data: buildNewProjectData(createdDeal, lead.niche, null),
      });

      await tx.projectLog.create({
        data: {
          projectId: createdProject.id,
          action: "setup",
          details: projectSetupLogDetails(createdDeal.package),
          userId: user.id,
        },
      });

      return { deal: createdDeal, project: createdProject };
    });

    // Notify Head Account Managers that a new project awaits distribution (best-effort)
    await notifyHeadAccountManagersOfNewProject(lead.name, deal.package);

    // Notify Sales Manager about the closed deal
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, directManagerId: true } });
    if (dbUser?.directManagerId && process.env.PUSHER_APP_ID) {
      const managerLink = `/dashboard/sales/analytics`;
      const mgrMessage = `Agent ${dbUser.name} closed a new deal (${packageType}) for ${totalAmount} SAR.`;
      await prisma.notification.create({
        data: { userId: dbUser.directManagerId, title: "Deal Closed!", message: mgrMessage, link: managerLink }
      });
      await safeTrigger(`user-${dbUser.directManagerId}`, "new-notification", { title: "Deal Closed!", message: mgrMessage, link: managerLink });
    }

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    console.error("Failed to create deal:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

