import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveSessionUser } from "@/lib/activeSessionUser";
import ColdLeadsClient from "./ColdLeadsClient";

export default async function ColdLeadsPage() {
  const session = await getServerSession(authOptions);
  const user = await getActiveSessionUser(session?.user as any);

  if (!user) {
    redirect("/login");
  }

  if (!["tele_sales_agent", "tele_sales_manager", "super_admin"].includes(user.role)) {
    redirect("/dashboard");
  }

  // Agents see their own Draft pool; managers/admin see the whole pool
  // they (or their team) created so they can monitor and bulk-promote.
  const where: any = { status: "Draft" };
  if (user.role === "tele_sales_agent") {
    where.createdById = user.id;
  }
  const coldLeads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      storeLink: true,
      niche: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Add Cold Leads</h1>
      <p className="text-sm text-gray-500 mb-6">
        Manually add new cold leads you have gathered.
      </p>
      <ColdLeadsClient initialLeads={coldLeads} agentId={user.id} userRole={user.role} />
    </div>
  );
}
