import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SalesMyTeamClient from "./SalesMyTeamClient";

export default async function SalesMyTeamPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "cheif_sales", "sales_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  // Get agents under this manager (or all sales agents for super_admin/cheif_sales)
  const whereClause: any = { role: "sales_agent" };
  if (user.role === "sales_manager") {
    whereClause.directManagerId = user.id;
  }

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
          meetingsAsSales: true,
        },
      },
      salesDeals: {
        select: { totalAmount: true, status: true },
      },
      salesLeads: {
        where: { status: "Closed_Lost" },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

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
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Sales Team Analytics</h1>
      <p className="text-sm text-gray-500 mb-6">
        Manage your sales agents — assign specializations and monitor closed deals and active leads.
      </p>
      <SalesMyTeamClient agents={agentsWithKPI as any} />
    </div>
  );
}
