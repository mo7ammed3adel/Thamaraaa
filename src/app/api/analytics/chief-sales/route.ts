import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "chief_sales" && session.user?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "all";

  // Compute date range
  let startDate = new Date(0);
  const now = new Date();
  if (range === "today") {
    startDate = new Date(now.setHours(0, 0, 0, 0));
  } else if (range === "this_week") {
    const day = now.getDay() || 7;
    if (day !== 1) now.setHours(-24 * (day - 1));
    startDate = new Date(now.setHours(0, 0, 0, 0));
  } else if (range === "this_month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const dateFilter = range !== "all" ? { gte: startDate } : undefined;

  try {
    // 1. Core Revenue & Deals
    const deals = await prisma.deal.findMany({
      where: dateFilter ? { createdAt: dateFilter } : {},
      include: {
        salesAgent: { select: { name: true } },
        lead: { select: { name: true, niche: true, source: true } },
        installments: { orderBy: { dueDate: "asc" } }
      }
    });

    const wonDeals = deals.filter(d => d.status === "Closed_Won" || d.status === "Pending"); // Assuming dealing implies revenue
    const totalRevenue = wonDeals.reduce((sum, d) => sum + d.totalAmount, 0);
    const totalNetTarget = wonDeals.reduce((sum, d) => sum + d.netTarget, 0);

    const totalCollected = wonDeals.reduce((sum, d) => {
      const collectedInstallments = d.installments
        .filter((inst) => inst.isPaid)
        .reduce((instSum, inst) => instSum + inst.amount, 0);
      const collected = (d.firstAmount || 0) + collectedInstallments;
      return sum + collected;
    }, 0);

    // 2. Leads Pipeline
    const leadsCount = await prisma.lead.count({
      where: dateFilter ? { createdAt: dateFilter } : {}
    });

    // 3. TeleSales Performance (Meetings booked)
    const meetings = await prisma.meeting.findMany({
      where: dateFilter ? { createdAt: dateFilter } : {},
      include: {
        teleAgent: { select: { name: true } }
      }
    });

    const meetingsAttended = meetings.filter(m => m.status === "Attended").length;
    const meetingsLost = meetings.filter(m => m.status === "Lost").length;

    // 4. Group by TeleSales Agents for Table
    const teleSalesPerformance = await prisma.user.findMany({
      where: { role: { in: ["tele_sales_agent", "tele_sales_manager"] }, status: "Active" },
      select: {
        id: true, name: true,
        meetingsAsTele: { 
          where: dateFilter ? { createdAt: dateFilter } : {},
          select: { status: true } 
        }
      }
    });

    // 5. Group by Sales Agents for Table
    const salesPerformance = await prisma.user.findMany({
      where: { role: { in: ["sales_agent", "sales_manager"] }, status: "Active" },
      select: {
        id: true, name: true,
        salesDeals: {
          where: dateFilter ? { createdAt: dateFilter } : {},
          select: { totalAmount: true, status: true, netTarget: true }
        }
      }
    });

    // 6. Recent Active Warnings
    const warnings = await prisma.warning.findMany({
      where: { status: "Active" },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    // Build the final response
    return NextResponse.json({
      overview: {
        totalRevenue,
        totalNetTarget,
        totalCollected,
        totalDeals: wonDeals.length,
        totalLeads: leadsCount,
        meetingsBooked: meetings.length,
        meetingsAttended,
        meetingsLost
      },
      chartData: {
        // Mocked chart data for now, ideally dynamically aggregated by date
        revenueProgress: 65, 
        leadsConversion: leadsCount ? Math.round((wonDeals.length / leadsCount) * 100) : 0
      },
      teleSalesTeam: teleSalesPerformance.map(agent => ({
        name: agent.name,
        meetingsBooked: agent.meetingsAsTele.length,
        attended: agent.meetingsAsTele.filter(m => m.status === "Attended").length,
        lost: agent.meetingsAsTele.filter(m => m.status === "Lost").length,
      })).sort((a,b) => b.meetingsBooked - a.meetingsBooked),
      salesTeam: salesPerformance.map(agent => ({
        name: agent.name,
        dealsClosed: agent.salesDeals.filter(d => d.status === "Closed_Won" || d.status === "Pending").length,
        revenueGenerated: agent.salesDeals.reduce((sum, d) => sum + d.totalAmount, 0),
        avgDealSize: agent.salesDeals.length ? Math.round(agent.salesDeals.reduce((sum, d) => sum + d.totalAmount, 0) / agent.salesDeals.length) : 0
      })).sort((a,b) => b.revenueGenerated - a.revenueGenerated),
      recentDeals: deals.slice(0, 10),
      warnings
    });
  } catch (error) {
    console.error("Chief Sales API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
