import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Agent sees own deals tracked via tele leads, Manager/Admin sees all
    const whereClause: any = { status: "Closed_Won" };

    if (user.role === "tele_sales_agent") {
      whereClause.lead = { assignedTeleAgentId: user.id };
    } else if (user.role === "sales_agent") {
      whereClause.salesAgentId = user.id;
    }

    const deals = await prisma.deal.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        lead: {
          include: {
            teleAgent: { select: { name: true, id: true } },
            callLogs: {
              orderBy: { createdAt: "asc" },
              include: {
                agent: { select: { name: true } },
              },
            },
            meetings: {
              orderBy: { createdAt: "asc" },
              include: {
                teleAgent: { select: { name: true } },
                salesAgent: { select: { name: true } },
              },
            },
          },
        },
        salesAgent: { select: { name: true, id: true } },
        installments: { orderBy: { dueDate: "asc" } },
      },
    });

    return NextResponse.json(deals);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
