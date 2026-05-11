export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const role = user.role;

    // Build date filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }
    const createdAtFilter = (from || to) ? { createdAt: dateFilter } : {};

    if (role === "tele_sales_agent") {
      // Total leads assigned
      const totalLeads = await prisma.lead.count({
        where: {
          assignedTeleAgentId: user.id,
          ...createdAtFilter,
        },
      });

      // Call logs by status
      const callLogs = await prisma.callLog.findMany({
        where: {
          agentId: user.id,
          ...createdAtFilter,
        },
        select: {
          id: true,
          callStatus: true,
          notes: true,
          createdAt: true,
          lead: { select: { name: true, phone: true, classification: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const acceptButLost = callLogs.filter(c => c.callStatus === "Accept but lost").length;
      const acceptAndBook = callLogs.filter(c => c.callStatus === "Accept and book meeting").length;
      const busy = callLogs.filter(c => c.callStatus === "Busy").length;
      const wrongNumber = callLogs.filter(c => c.callStatus === "Wrong Number").length;
      const totalCalls = callLogs.length;

      // Meetings booked
      const meetingsBooked = await prisma.meeting.count({
        where: {
          teleAgentId: user.id,
          ...createdAtFilter,
        },
      });

      return NextResponse.json({
        role: "tele_sales_agent",
        totalLeads,
        totalCalls,
        acceptButLost,
        acceptAndBook,
        busy,
        wrongNumber,
        meetingsBooked,
        callLogs,
      });
    }

    if (role === "sales_agent") {
      // Total leads received
      const totalLeads = await prisma.lead.count({
        where: {
          assignedSalesAgentId: user.id,
          ...createdAtFilter,
        },
      });

      // Leads by status
      const leads = await prisma.lead.findMany({
        where: {
          assignedSalesAgentId: user.id,
          ...createdAtFilter,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          classification: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Meetings
      const meetings = await prisma.meeting.findMany({
        where: {
          salesAgentId: user.id,
          ...createdAtFilter,
        },
        select: {
          id: true,
          leadId: true,
          status: true,
          meetingDate: true,
          meetingTime: true,
          createdAt: true,
          lead: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const meetingsAttended = meetings.filter(m => m.status === "Attended" || m.status === "Won").length;

      // Deals
      const deals = await prisma.deal.findMany({
        where: {
          salesAgentId: user.id,
          ...createdAtFilter,
        },
        select: {
          id: true,
          totalAmount: true,
          status: true,
          package: true,
          createdAt: true,
          lead: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const dealsWon = deals.filter(d => d.status === "Closed_Won" || d.status === "Pending").length;
      const dealsLost = deals.filter(d => d.status === "Closed_Lost").length;
      const revenue = deals
        .filter(d => d.status === "Closed_Won" || d.status === "Pending")
        .reduce((sum, d) => sum + (d.totalAmount || 0), 0);

      return NextResponse.json({
        role: "sales_agent",
        totalLeads,
        meetingsAttended,
        dealsWon,
        dealsLost,
        revenue,
        leads,
        meetings,
        deals,
      });
    }

    return NextResponse.json({ error: "Role not supported" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
