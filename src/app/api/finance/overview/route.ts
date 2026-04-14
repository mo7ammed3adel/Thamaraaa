import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "accountant" && session.user?.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deals = await prisma.deal.findMany({
      where: { status: { in: ["Pending", "Closed_Won"] } },
      include: { lead: true, salesAgent: { select: { name: true } } }
    });

    const totalRevenue = deals.reduce((sum, d) => sum + d.totalAmount, 0);
    const totalCollected = deals.reduce((sum, d) => {
      let collected = d.firstAmount || 0;
      if (d.installment1Collected) collected += d.installment1Amount || 0;
      if (d.installment2Collected) collected += d.installment2Amount || 0;
      if (d.installment3Collected) collected += d.installment3Amount || 0;
      return sum + collected;
    }, 0);

    const pendingInstallments = await prisma.installment.findMany({
      where: { isPaid: false },
      include: { deal: { include: { lead: true } } },
      orderBy: { dueDate: "asc" }
    });

    const upcomingAmounts = pendingInstallments.reduce((sum, inst) => sum + inst.amount, 0);

    return NextResponse.json({
      overview: {
        totalRevenue,
        totalCollected,
        totalRemaining: totalRevenue - totalCollected,
        upcomingAmounts,
        dealsCount: deals.length
      },
      deals,
      pendingInstallments
    });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
