import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FUND_DEAL_STATUSES } from "@/lib/deals";
import SalesManagerTargetsClient from "./SalesManagerTargetsClient";
import { getTranslator } from "@/server/i18n/locale";

export default async function ChiefSalesManagersPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "chief_sales"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthStart = new Date(currentMonth + "-01T00:00:00Z");
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  const managers = await prisma.user.findMany({
    where: { role: "sales_manager" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      agentTargets: { where: { month: currentMonth }, select: { target: true } },
    },
    orderBy: { name: "asc" },
  });

  // Each manager's fund is their team's deals (direct-report sales agents) plus
  // any deals they closed personally - the same scope the commission engine
  // uses for the Sales Team Leader tier.
  const managersWithFund = await Promise.all(
    managers.map(async (m) => {
      const teamAgents = await prisma.user.findMany({
        where: { role: "sales_agent", directManagerId: m.id },
        select: { id: true },
      });
      const salesAgentIds = [...teamAgents.map((a) => a.id), m.id];
      const fundResult = await prisma.deal.aggregate({
        where: {
          salesAgentId: { in: salesAgentIds },
          status: { in: FUND_DEAL_STATUSES },
          createdAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { totalAmount: true },
      });
      return {
        id: m.id,
        name: m.name,
        email: m.email,
        status: m.status,
        target: m.agentTargets[0]?.target || 0,
        achievedFund: fundResult._sum.totalAmount || 0,
        teamSize: teamAgents.length,
      };
    })
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("nav.salesManagers")}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Set each Sales Manager&apos;s monthly fund target (SAR) and track their team&apos;s contracted revenue.
      </p>
      <SalesManagerTargetsClient managers={managersWithFund} />
    </div>
  );
}
