import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FUND_DEAL_STATUSES } from "@/lib/deals";
import { ACTUAL_MEETING_STATUSES } from "@/lib/meetings";
import SalesMyTeamClient from "./SalesMyTeamClient";
import TeleManagerTargetsPanel from "./TeleManagerTargetsPanel";

export default async function SalesMyTeamPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "chief_sales", "sales_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  // Get agents under this manager (or all sales agents for super_admin/chief_sales).
  // Sales manager also sees orphan agents (no directManager yet) so newly-created
  // sales agents are visible - matches the dashboard's listing behavior.
  const whereClause: any = { role: "sales_agent" };
  if (user.role === "sales_manager") {
    whereClause.OR = [{ directManagerId: user.id }, { directManagerId: null }];
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Current month for the monthly target (YYYY-MM).
  const currentMonth = new Date().toISOString().slice(0, 7);

  const agents = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      specialization: true,
      status: true,
      level: true,
      _count: {
        select: {
          salesLeads: true,
          salesDeals: true,
          meetingsAsSales: {
            where: {
              meetingDate: {
                gte: startOfDay,
                lte: endOfDay
              }
            }
          },
        },
      },
      salesDeals: {
        select: { totalAmount: true, status: true },
      },
      salesLeads: {
        where: { status: "Closed_Lost" },
        select: { id: true },
      },
      agentTargets: {
        where: { month: currentMonth },
        select: { target: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // The monthly target is a fund (SAR) target, so progress against it is
  // measured on this month's contracted deal value - not the all-time revenue
  // shown in the KPI cards below.
  const monthStart = new Date(currentMonth + "-01T00:00:00Z");
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  const monthlyFundByAgent = agents.length
    ? await prisma.deal.groupBy({
        by: ["salesAgentId"],
        where: {
          salesAgentId: { in: agents.map(a => a.id) },
          status: { in: FUND_DEAL_STATUSES },
          createdAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { totalAmount: true },
      })
    : [];
  const monthlyFundMap = new Map(monthlyFundByAgent.map(m => [m.salesAgentId, m._sum.totalAmount || 0]));

  // Flatten for client
  const agentsWithKPI = agents.map(a => ({
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    specialization: a.specialization,
    status: a.status,
    level: a.level,
    _count: a._count,
    lostCount: a.salesLeads.length,
    revenue: a.salesDeals.reduce((sum, d) => sum + (d.totalAmount || 0), 0),
    dealsWonCount: a.salesDeals.filter(d => d.status === "Closed_Won" || d.status === "Pending").length,
    monthlyFund: monthlyFundMap.get(a.id) || 0,
    target: a.agentTargets[0]?.target || 0,
  }));

  // A Sales Manager also oversees the TeleSales Manager, so they set that
  // manager's monthly meetings target here too (super_admin sees every
  // TeleSales Manager; chief_sales does not - that's one level up the chain).
  let teleManagers: { id: string; name: string; email: string; status: string; target: number; achieved: number }[] = [];
  if (["sales_manager", "super_admin"].includes(user.role)) {
    const tmWhere: any = { role: "tele_sales_manager" };
    if (user.role === "sales_manager") {
      tmWhere.OR = [{ directManagerId: user.id }, { directManagerId: null }];
    }
    const tms = await prisma.user.findMany({
      where: tmWhere,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        agentTargets: { where: { month: currentMonth }, select: { target: true } },
      },
      orderBy: { name: "asc" },
    });

    teleManagers = await Promise.all(
      tms.map(async (tm) => {
        const teamAgents = await prisma.user.findMany({
          where: { role: "tele_sales_agent", directManagerId: tm.id },
          select: { id: true },
        });
        const teamIds = teamAgents.map((a) => a.id);
        const achieved = teamIds.length
          ? await prisma.meeting.count({
              where: {
                teleAgentId: { in: teamIds },
                status: { in: ACTUAL_MEETING_STATUSES },
                meetingDate: { gte: monthStart, lt: monthEnd },
              },
            })
          : 0;
        return {
          id: tm.id,
          name: tm.name,
          email: tm.email,
          status: tm.status,
          target: tm.agentTargets[0]?.target || 0,
          achieved,
        };
      })
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Sales Team Analytics</h1>
      <p className="text-sm text-gray-500 mb-6">
        Manage your sales agents - assign specializations and monitor closed deals and active leads.
      </p>
      {teleManagers.length > 0 && <TeleManagerTargetsPanel managers={teleManagers} />}
      <SalesMyTeamClient agents={agentsWithKPI as any} />
    </div>
  );
}
