import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ChiefSalesClient from "./ChiefSalesClient";

export default async function ChiefSalesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "chief_sales"].includes(user?.role)) {
    redirect("/dashboard");
  }

  // Fetch all deals with leads and sales agents
  const deals = await prisma.deal.findMany({
    include: {
      lead: true,
      salesAgent: true,
      projects: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch all sales-related users for team overview
  const salesTeam = await prisma.user.findMany({
    where: {
      role: { in: ["sales_agent", "sales_manager", "tele_sales_agent", "tele_sales_manager"] },
      status: "Active",
    },
    include: {
      salesDeals: { where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
      callLogs: { where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
      meetingsAsSales: { where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
    },
  });

  // Fetch recent warnings
  const warnings = await prisma.warning.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Fetch projects for pipeline
  const projects = await prisma.project.findMany({
    include: { deal: { include: { lead: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Calculate KPIs
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDeals = deals.filter((d) => new Date(d.createdAt) >= today);
  const totalRevenueToday = todayDeals.reduce((s, d) => s + d.totalAmount, 0);
  const pipelineValue = deals.filter((d) => d.status === "Pending").reduce((s, d) => s + d.totalAmount, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Chief Sales Dashboard</h1>
      <ChiefSalesClient
        deals={deals}
        salesTeam={salesTeam}
        warnings={warnings}
        projects={projects}
        kpis={{
          totalRevenueToday,
          closedDealsToday: todayDeals.length,
          pipelineValue,
          totalDeals: deals.length,
        }}
      />
    </div>
  );
}
