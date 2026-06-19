export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Intended to be run daily via Vercel Cron or external ping
    const today = new Date();
    today.setHours(0,0,0,0);
    const intervals = [15, 10, 5, 1]; // Reminder milestone days (before due)
    const overdueIntervals = [1, 3, 7, 15]; // Overdue milestone days (after due)

    const installments = await prisma.installment.findMany({
      where: { isPaid: false },
      include: { deal: true }
    });

    let notificationsCreated = 0;

    for (const inst of installments) {
      const dueDate = new Date(inst.dueDate);
      dueDate.setHours(0,0,0,0);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (intervals.includes(diffDays) || diffDays === 0) {
        // Notify Sales Agent
        await prisma.notification.create({
          data: {
            userId: inst.deal.salesAgentId,
            title: `Payment Reminder: ${diffDays === 0 ? 'DUE TODAY' : `${diffDays} days left`}`,
            message: `Installment of SAR ${inst.amount} is due ${diffDays === 0 ? 'TODAY' : `in ${diffDays} days`}.`,
            link: "/dashboard/sales",
          }
        });
        notificationsCreated++;

        // Notify Accountant
        const accountant = await prisma.user.findFirst({ where: { role: "accountant", status: "Active" } });
        if (accountant) {
          await prisma.notification.create({
            data: {
              userId: accountant.id,
              title: `Payment Follow-up: ${diffDays === 0 ? 'DUE TODAY' : `${diffDays} days left`}`,
              message: `An installment of SAR ${inst.amount} is set to be paid ${diffDays === 0 ? 'TODAY' : `in ${diffDays} days`}.`,
              link: "/dashboard/finance",
            }
          });
          notificationsCreated++;
        }
      } else if (diffDays < 0 && overdueIntervals.includes(Math.abs(diffDays))) {
        // Overdue: installment past its due date — alert the agent + accountant.
        const daysOverdue = Math.abs(diffDays);
        await prisma.notification.create({
          data: {
            userId: inst.deal.salesAgentId,
            title: `Payment OVERDUE: ${daysOverdue} days`,
            message: `Installment of SAR ${inst.amount} is overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}.`,
            type: "payment_overdue",
            link: "/dashboard/sales",
          }
        });
        notificationsCreated++;

        const overdueAccountant = await prisma.user.findFirst({ where: { role: "accountant", status: "Active" } });
        if (overdueAccountant) {
          await prisma.notification.create({
            data: {
              userId: overdueAccountant.id,
              title: `Payment OVERDUE: ${daysOverdue} days`,
              message: `Installment of SAR ${inst.amount} is overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}.`,
              type: "payment_overdue",
              link: "/dashboard/finance",
            }
          });
          notificationsCreated++;
        }
      }
    }

    return NextResponse.json({ success: true, processedInstallments: installments.length, notificationsCreated });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
