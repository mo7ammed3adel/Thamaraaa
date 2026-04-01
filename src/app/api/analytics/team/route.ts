export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || !["super_admin", "tele_sales_manager"].includes(user.role)) {
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
    const meetingDateFilter = (from || to) ? { meetingDate: dateFilter } : {};

    // Get all tele_sales_agents under this manager (or all if super_admin)
    const agentFilter: any = { role: "tele_sales_agent" };
    if (user.role === "tele_sales_manager") {
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

    // Get call logs for these agents
    const callLogs = await prisma.callLog.findMany({
      where: {
        agentId: { in: agentIds },
        ...createdAtFilter,
      },
      select: {
        agentId: true,
        callStatus: true,
        leadId: true,
        createdAt: true,
      },
    });

    // Get meetings for these agents
    const meetings = await prisma.meeting.findMany({
      where: {
        teleAgentId: { in: agentIds },
        ...meetingDateFilter,
      },
      select: {
        teleAgentId: true,
        status: true,
        dealAmount: true,
      },
    });

    // Get deals via leads assigned to these agents
    const deals = await prisma.deal.findMany({
      where: {
        lead: { assignedTeleAgentId: { in: agentIds } },
        ...createdAtFilter,
      },
      select: {
        lead: { select: { assignedTeleAgentId: true } },
        totalAmount: true,
        status: true,
      },
    });

    // Aggregate per agent
    const analyticsMap: Record<string, any> = {};
    for (const agent of agents) {
      analyticsMap[agent.id] = {
        ...agent,
        totalCalls: 0,
        meetingsBooked: 0,
        meetingsAttended: 0,
        dealsClosed: 0,
        revenue: 0,
      };
    }

    for (const log of callLogs) {
      if (analyticsMap[log.agentId]) {
        analyticsMap[log.agentId].totalCalls++;
        if (log.callStatus === "Accept and book meeting") {
          analyticsMap[log.agentId].meetingsBooked++;
        }
      }
    }

    for (const meeting of meetings) {
      if (analyticsMap[meeting.teleAgentId]) {
        if (meeting.status === "Attended" || meeting.status === "Won") {
          analyticsMap[meeting.teleAgentId].meetingsAttended++;
        }
      }
    }

    for (const deal of deals) {
      const agentId = deal.lead?.assignedTeleAgentId;
      if (agentId && analyticsMap[agentId]) {
        if (deal.status === "Closed_Won") {
          analyticsMap[agentId].dealsClosed++;
          analyticsMap[agentId].revenue += deal.totalAmount || 0;
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
