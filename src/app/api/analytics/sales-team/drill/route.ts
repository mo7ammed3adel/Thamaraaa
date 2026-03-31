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
    const drillDown = searchParams.get("drillDown");

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }
    const createdAtFilter = (from || to) ? { createdAt: dateFilter } : {};

    // Get agent IDs under this manager
    const agentFilter: any = { role: "sales_agent" };
    if (user.role === "sales_manager") {
      agentFilter.directManagerId = user.id;
    }
    const agents = await prisma.user.findMany({ where: agentFilter, select: { id: true } });
    const agentIds = agents.map(a => a.id);

    if (drillDown === "leads") {
      const leads = await prisma.lead.findMany({
        where: { assignedSalesAgentId: { in: agentIds }, ...createdAtFilter },
        select: {
          id: true, name: true, phone: true, classification: true, status: true, createdAt: true,
          salesAgent: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(leads);
    }

    if (drillDown === "meetings") {
      const meetings = await prisma.meeting.findMany({
        where: { salesAgentId: { in: agentIds }, status: { in: ["Attended", "Won"] }, ...createdAtFilter },
        select: {
          id: true, status: true, meetingDate: true, meetingTime: true, createdAt: true,
          lead: { select: { name: true, phone: true } },
          salesAgent: { select: { name: true } },
          teleAgent: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(meetings);
    }

    if (drillDown === "won") {
      const deals = await prisma.deal.findMany({
        where: { salesAgentId: { in: agentIds }, status: { in: ["Closed_Won", "Pending"] }, ...createdAtFilter },
        select: {
          id: true, totalAmount: true, status: true, package: true, createdAt: true,
          lead: { select: { name: true, phone: true } },
          salesAgent: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(deals);
    }

    if (drillDown === "lost") {
      const deals = await prisma.deal.findMany({
        where: { salesAgentId: { in: agentIds }, status: "Closed_Lost", ...createdAtFilter },
        select: {
          id: true, totalAmount: true, status: true, package: true, createdAt: true,
          lead: { select: { name: true, phone: true } },
          salesAgent: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(deals);
    }

    if (drillDown === "revenue") {
      const deals = await prisma.deal.findMany({
        where: { salesAgentId: { in: agentIds }, status: { in: ["Closed_Won", "Pending"] }, ...createdAtFilter },
        select: {
          id: true, totalAmount: true, status: true, package: true, createdAt: true,
          lead: { select: { name: true, phone: true } },
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
