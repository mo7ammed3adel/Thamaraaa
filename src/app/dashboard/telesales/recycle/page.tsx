import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RecycleHotLeadsClient from "./RecycleHotLeadsClient";
import { getTranslator } from "@/server/i18n/locale";

export default async function RecycleHotLeadsPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "tele_sales_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  // Get lost leads that were hot/warm (meetings marked as lost)
  const lostLeads = await prisma.lead.findMany({
    where: {
      status: "Closed_Lost",
    },
    orderBy: { createdAt: "desc" },
    include: {
      teleAgent: { select: { name: true } },
      salesAgent: { select: { name: true } },
      callLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { notes: true, createdAt: true },
      },
      meetings: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          salesAgent: { select: { name: true } },
        },
      },
    },
  });

  // Get tele agents for re-assignment
  const teleAgents = await prisma.user.findMany({
    where: { role: "tele_sales_agent", status: "Active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("nav.recycleHotLeads")}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Meetings marked as lost — redistribute these leads back to agents for a second chance.
      </p>
      <RecycleHotLeadsClient leads={lostLeads} agents={teleAgents} />
    </div>
  );
}
