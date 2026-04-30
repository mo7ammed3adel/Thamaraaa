import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";

/**
 * POST /api/deals
 * Creates a new deal when a Sales Agent closes a sale.
 * Does NOT create a project — that is handled by /api/projects/setup
 * which is called separately after deal creation.
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

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.assignedSalesAgentId !== user.id && user.role !== "super_admin" && user.role !== "sales_manager") {
      return NextResponse.json({ error: "Forbidden: You are not assigned to this lead." }, { status: 403 });
    }

    // Fetch system configs for payment gateway fee
    const gatewayFeeConfig = await prisma.systemConfig.findUnique({ where: { key: "gateway_fee_pct" } });
    const gatewayFee = gatewayFeeConfig ? parseFloat(gatewayFeeConfig.value) : 0.08; // Default 8%

    let netTarget = parseFloat(totalAmount);
    if (paymentMethod === "Tabby" || paymentMethod === "Tamara") {
      netTarget = netTarget * (1 - gatewayFee);
    }

    const deal = await prisma.deal.create({
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
        contractImageUrl,
        receiptUrl,
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
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "Closed_Won" }
    });

    // Notify Sales Manager about the closed deal
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, directManagerId: true } });
    if (dbUser?.directManagerId && process.env.PUSHER_APP_ID) {
      const managerLink = `/dashboard/sales/analytics`;
      const mgrMessage = `Agent ${dbUser.name} closed a new deal (${packageType}) for ${totalAmount} SAR.`;
      await prisma.notification.create({
        data: { userId: dbUser.directManagerId, title: "Deal Closed!", message: mgrMessage, link: managerLink }
      });
      await pusherServer.trigger(`user-${dbUser.directManagerId}`, "new-notification", { title: "Deal Closed!", message: mgrMessage, link: managerLink });
    }

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    console.error("Failed to create deal:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

