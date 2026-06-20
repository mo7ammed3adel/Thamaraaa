import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WarningsCenterClient from "./WarningsCenterClient";

function projectScopeForUser(user: any) {
  if (["super_admin", "head_account_manager", "chief_sales"].includes(user.role)) return {};
  if (user.role === "account_manager") return { accountManagerId: user.id };
  if (user.role === "head_technical") return { headTechnicalId: user.id };
  if (user.role === "head_seo") return { headSeoId: user.id };
  if (user.role === "sales_agent") return { deal: { is: { salesAgentId: user.id } } };
  if (user.role === "sales_manager") {
    return { deal: { is: { salesAgent: { is: { directManagerId: user.id } } } } };
  }
  return {
    OR: [
      { teamAssignments: { some: { userId: user.id, status: "active" } } },
      { tasks: { some: { OR: [{ leaderId: user.id }, { agentId: user.id }] } } },
    ],
  };
}

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

  const canViewAllWarnings = ["super_admin", "head_account_manager", "chief_sales"].includes(user.role);
  const projectWhere = projectScopeForUser(user);
  const warningWhere = canViewAllWarnings
    ? {}
    : {
        OR: [
          { senderUserId: user.id },
          { receipts: { some: { userId: user.id } } },
          { project: { is: projectWhere } },
        ],
      };

  const warnings = await prisma.warning.findMany({
    where: warningWhere,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      sender: { select: { id: true, name: true, role: true } },
      receipts: {
        where: { isRead: true },
        include: { user: { select: { id: true, name: true, role: true } } },
      },
    },
  });

  // Fetch accessible projects for the warning target dropdown.
  const projects = await prisma.project.findMany({
    where: projectWhere,
    select: {
      id: true,
      deal: { select: { lead: { select: { name: true, phone: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const leads = projects.map((project) => ({
    id: project.id,
    name: project.deal?.lead?.name || "Unknown Client",
    phone: project.deal?.lead?.phone || "",
  }));

  const enrichedWarnings = warnings.map((w) => ({
    ...w,
    senderName: w.sender?.name || "Unknown",
    ackList: w.receipts.map((receipt) => ({
      userName: receipt.user.name,
      role: receipt.user.role,
    })),
    recipientList: (() => { try { return JSON.parse(w.recipientRoles); } catch { return []; } })(),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">⚠️ Warnings Center</h1>
      <WarningsCenterClient warnings={enrichedWarnings} leads={leads} userRole={user.role} userId={user.id} />
    </div>
  );
}
