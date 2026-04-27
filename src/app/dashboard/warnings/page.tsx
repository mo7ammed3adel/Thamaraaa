import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WarningsCenterClient from "./WarningsCenterClient";

export default async function WarningsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  const allowedRoles = [
    "super_admin", "chief_sales", "head_account_manager", "account_manager",
    "head_technical", "head_seo", "sales_manager",
    "team_leader_seo", "team_leader_social_media", "team_leader_media_buyer",
    "leader_graphic_designer", "leader_motion_graphic", "leader_ui",
    "agent_seo", "agent_content_seo", "agent_social_media", "agent_media_buyer",
    "agent_graphic_designer", "agent_motion_graphic", "agent_ui",
  ];
  if (!allowedRoles.includes(user?.role)) {
    redirect("/dashboard");
  }

  const warnings = await prisma.warning.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Fetch clients for dropdown
  const leads = await prisma.lead.findMany({
    where: { status: { not: "Archived" } },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
    take: 200,
  });

  // Fetch sender names
  const senderIds = warnings.map((w) => w.senderUserId).filter((v, i, a) => a.indexOf(v) === i);
  const senders = await prisma.user.findMany({
    where: { id: { in: senderIds } },
    select: { id: true, name: true },
  });
  const senderMap = Object.fromEntries(senders.map((s) => [s.id, s.name]));

  const enrichedWarnings = warnings.map((w) => ({
    ...w,
    senderName: senderMap[w.senderUserId] || "Unknown",
    ackList: (() => { try { return JSON.parse(w.acknowledgedBy); } catch { return []; } })(),
    recipientList: (() => { try { return JSON.parse(w.recipientRoles); } catch { return []; } })(),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">⚠️ Warnings Center</h1>
      <WarningsCenterClient warnings={enrichedWarnings} leads={leads} userRole={user.role} userId={user.id} />
    </div>
  );
}
