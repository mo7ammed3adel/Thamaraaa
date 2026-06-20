export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || !["super_admin", "sales_manager"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Build date filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }

    const createdAtFilter = (from || to) ? { createdAt: dateFilter } : {};

    // Get all sales_agents under this manager (or all if super_admin).
    const agentFilter: any = { role: "sales_agent" };
    if (user.role === "sales_manager") {
      agentFilter.directManagerId = user.id;
    }

    const agents = await prisma.user.findMany({
      where: agentFilter,
      select: {
        id: true,
        name: true,
        email: true,
        specialization: true,
        status: true,
      },
    });

    const agentIds = agents.map((a) => a.id);

    // Get leads assigned to these agents
    const leads = await prisma.lead.findMany({
      where: {
        assignedSalesAgentId: { in: agentIds },
        ...createdAtFilter,
      },
      select: {
        assignedSalesAgentId: true,
        status: true,
      },
    });

    // Get meetings for these agents
    const meetings = await prisma.meeting.findMany({
      where: {
        salesAgentId: { in: agentIds },
        ...createdAtFilter,
      },
      select: {
        salesAgentId: true,
        status: true,
      },
    });

    // Get deals for these agents
    const deals = await prisma.deal.findMany({
      where: {
        salesAgentId: { in: agentIds },
        ...createdAtFilter,
      },
      select: {
        salesAgentId: true,
        totalAmount: true,
        status: true,
      },
    });

    // Aggregate per agent
    const analyticsMap: Record<string, any> = {};
    for (const agent of agents) {
      analyticsMap[agent.id] = {
        ...agent,
        totalLeads: 0,
        meetingsAttended: 0,
        dealsWon: 0,
        dealsLost: 0,
        revenue: 0,
      };
    }

    for (const lead of leads) {
      const agentId = lead.assignedSalesAgentId;
      if (agentId && analyticsMap[agentId]) {
        analyticsMap[agentId].totalLeads++;
      }
    }

    for (const meeting of meetings) {
      const agentId = meeting.salesAgentId;
      if (agentId && analyticsMap[agentId]) {
        if (meeting.status === "Attended" || meeting.status === "Won") {
          analyticsMap[agentId].meetingsAttended++;
        }
      }
    }

    for (const deal of deals) {
      const agentId = deal.salesAgentId;
      if (agentId && analyticsMap[agentId]) {
        if (deal.status === "Closed_Won" || deal.status === "Pending") {
          analyticsMap[agentId].dealsWon++;
          analyticsMap[agentId].revenue += deal.totalAmount || 0;
        } else if (deal.status === "Closed_Lost") {
          analyticsMap[agentId].dealsLost++;
        }
      }
    }

    const analytics = Object.values(analyticsMap);

    return NextResponse.json(analytics);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
