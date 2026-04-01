import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";

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
      totalAmount, paymentMethod, installments, 
      contractImageUrl, receiptUrl 
    } = data;

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

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "Closed_Won" }
    });

    // Automatically trigger Project creation for the Account Manager queue
    // Assign to a generic waiting state or specific manager if logic dictates
    const defaultAM = await prisma.user.findFirst({ where: { role: "head_account_manager", status: "Active" } });

    if (defaultAM) {
      await prisma.project.create({
        data: {
          dealId: deal.id,
          accountManagerId: defaultAM.id,
          package: packageType,
          finalStatus: "Active"
        }
      });

      // 1. Notify Account Manager
      if (process.env.PUSHER_APP_ID) {
        const amMessage = `New project from Deal #${deal.id.slice(-4)} (${packageType})`;
        await prisma.notification.create({
          data: { userId: defaultAM.id, title: "New Project Assigned", message: amMessage, link: `/dashboard/deals` }
        });
        await pusherServer.trigger(`user-${defaultAM.id}`, "new-notification", { title: "New Project Assigned", message: amMessage, link: `/dashboard/deals` });
      }
    }

    // Target URLs for notifications
    const managerLink = `/dashboard/sales/analytics`;

    // 2. Notify Sales Manager
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, directManagerId: true } });
    if (dbUser?.directManagerId && process.env.PUSHER_APP_ID) {
      const mgrMessage = `Agent ${dbUser.name} closed a new deal (${packageType}) for ${totalAmount} SAR.`;
      await prisma.notification.create({
        data: { userId: dbUser.directManagerId, title: "Deal Closed!", message: mgrMessage, link: managerLink }
      });
      await pusherServer.trigger(`user-${dbUser.directManagerId}`, "new-notification", { title: "Deal Closed!", message: mgrMessage, link: managerLink });
    }

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
