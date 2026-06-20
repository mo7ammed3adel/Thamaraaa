export const dynamic = "force-dynamic";
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
    if (!["super_admin", "chief_sales", "tele_sales_manager", "tele_sales_agent", "sales_manager", "sales_agent"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Agents see their own deals; managers see only their direct teams.
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
