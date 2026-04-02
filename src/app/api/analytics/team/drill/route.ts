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
    const drillDown = searchParams.get("drillDown");

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }
    const createdAtFilter = (from || to) ? { createdAt: dateFilter } : {};
    const meetingDateFilter = (from || to) ? { meetingDate: dateFilter } : {};

    const agentFilter: any = { role: "tele_sales_agent" };
    if (user.role === "tele_sales_manager") {
      agentFilter.directManagerId = user.id;
    }
    const agents = await prisma.user.findMany({ where: agentFilter, select: { id: true } });
    const agentIds = agents.map(a => a.id);

    if (drillDown === "calls") {
      const callLogs = await prisma.callLog.findMany({
        where: { agentId: { in: agentIds }, ...createdAtFilter },
        select: {
          id: true, callStatus: true, notes: true, createdAt: true,
          lead: { select: { name: true, phone: true, classification: true } },
          agent: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(callLogs);
    }

    if (drillDown === "meetings") {
      const meetings = await prisma.meeting.findMany({
        where: { teleAgentId: { in: agentIds }, ...meetingDateFilter },
        select: {
          id: true, status: true, meetingDate: true, meetingTime: true, createdAt: true,
          lead: { select: { name: true, phone: true } },
          teleAgent: { select: { name: true } },
          salesAgent: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(meetings);
    }

    if (drillDown === "attended") {
      const meetings = await prisma.meeting.findMany({
        where: { teleAgentId: { in: agentIds }, status: { in: ["Attended", "Won", "Lost"] }, ...meetingDateFilter },
        select: {
          id: true, status: true, meetingDate: true, meetingTime: true, createdAt: true,
          lead: { select: { name: true, phone: true } },
          teleAgent: { select: { name: true } },
          salesAgent: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(meetings);
    }

    if (drillDown === "deals") {
      const deals = await prisma.deal.findMany({
        where: { lead: { assignedTeleAgentId: { in: agentIds } }, status: "Closed_Won", ...createdAtFilter },
        select: {
          id: true, totalAmount: true, status: true, package: true, createdAt: true,
          lead: { select: { name: true, phone: true, teleAgent: { select: { name: true } } } },
          salesAgent: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(deals);
    }

    if (drillDown === "revenue") {
      const deals = await prisma.deal.findMany({
        where: { lead: { assignedTeleAgentId: { in: agentIds } }, status: "Closed_Won", ...createdAtFilter },
        select: {
          id: true, totalAmount: true, status: true, package: true, createdAt: true,
          lead: { select: { name: true, phone: true, teleAgent: { select: { name: true } } } },
          salesAgent: { select: { name: true } },
        },
        orderBy: { totalAmount: "desc" },
        take: 200,
      });
      return NextResponse.json(deals);
    }

    return NextResponse.json({ error: "Invalid drillDown type" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
