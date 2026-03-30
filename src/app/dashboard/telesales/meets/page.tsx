import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MeetsClient from "./MeetsClient";

export default async function MeetsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "tele_sales_manager", "tele_sales_agent"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const isAgent = user.role === "tele_sales_agent";
  const agentId = user.id;

  // Get meetings for this agent (or all for manager)
  const meetingsWhere = isAgent ? { teleAgentId: agentId } : {};
  const meetings = await prisma.meeting.findMany({
    where: meetingsWhere,
    orderBy: { meetingDate: "desc" },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          classification: true,
          source: true,
          status: true,
        },
      },
      teleAgent: { select: { name: true } },
      salesAgent: { select: { name: true } },
    },
  });

  // Get agent performance summary
  let performanceSummary = null;
  if (isAgent) {
    const totalCalls = await prisma.callLog.count({ where: { agentId } });
    const meetingsSet = await prisma.callLog.count({
      where: { agentId, callStatus: "Meeting Booked" },
    });
    const dealsCount = await prisma.deal.count({
      where: { lead: { assignedTeleAgentId: agentId }, status: "Closed_Won" },
    });
    const dealsRevenue = await prisma.deal.aggregate({
      where: { lead: { assignedTeleAgentId: agentId }, status: "Closed_Won" },
      _sum: { totalAmount: true },
    });

    performanceSummary = {
      totalCalls,
      meetingsSet,
      dealsCount,
      revenue: dealsRevenue._sum.totalAmount || 0,
    };
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Meets</h1>
      <p className="text-sm text-gray-500 mb-6">
        {isAgent
          ? "Your meetings overview and personal performance summary."
          : "All team meetings and their outcomes."
        }
      </p>
      <MeetsClient meetings={meetings} performance={performanceSummary} isAgent={isAgent} />
    </div>
  );
}
