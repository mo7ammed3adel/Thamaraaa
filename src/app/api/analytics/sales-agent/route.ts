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
    const agentId = searchParams.get("agentId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }
    const createdAtFilter = (from || to) ? { createdAt: dateFilter } : {};

    // Get agent info
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, email: true, specialization: true, role: true, directManagerId: true },
    });
    if (!agent || agent.role !== "sales_agent") {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    if (user.role === "sales_manager" && agent.directManagerId !== user.id) {
      return NextResponse.json({ error: "Forbidden: agent is not in your team" }, { status: 403 });
    }
    const { role: _agentRole, directManagerId: _directManagerId, ...safeAgent } = agent;

    // Get leads assigned to this sales agent
    const leads = await prisma.lead.findMany({
      where: {
        assignedSalesAgentId: agentId,
        ...createdAtFilter,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        classification: true,
        status: true,
        createdAt: true,
      },
    });

    // Get meetings
    const meetings = await prisma.meeting.findMany({
      where: { salesAgentId: agentId, ...createdAtFilter },
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { name: true, phone: true } },
        teleAgent: { select: { name: true } },
      },
    });

    // Get deals
    const deals = await prisma.deal.findMany({
      where: {
        salesAgentId: agentId,
        ...createdAtFilter,
      },
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { name: true, phone: true } },
      },
    });

    return NextResponse.json({ agent: safeAgent, leads, meetings, deals });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
