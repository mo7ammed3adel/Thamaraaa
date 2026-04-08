import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SocialMediaClient from "../social-media/SocialMediaClient";

export default async function MediaBuyerPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "team_leader_media_buyer", "agent_media_buyer"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const isTL = ["super_admin", "team_leader_media_buyer"].includes(user.role);

  // Fetch Projects linked to this TL or Agent through media_buying tasks
  const rawProjects = await prisma.project.findMany({
    where: isTL
      ? { tasks: { some: { taskType: "media_buying", leaderId: user.id } } }
      : { tasks: { some: { taskType: "media_buying", agentId: user.id } } },
    include: {
      deal: { include: { lead: true } },
      accountManager: true,
      tasks: { include: { leader: true, agent: true, subTasks: { include: { leader: true, agent: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const projectIds = rawProjects.map(p => p.id);
  const leadIds = rawProjects.map(p => p.deal?.leadId).filter(Boolean);

  const warnings = await prisma.warning.findMany({
    where: {
      OR: [
        { projectId: { in: projectIds } },
        { clientId: { in: leadIds as string[] } }
      ]
    }
  });

  const projects = rawProjects.map(p => ({
    ...p,
    warnings: warnings.filter(w => w.projectId === p.id || w.clientId === p.deal?.leadId)
  }));

  const agents = isTL
    ? await prisma.user.findMany({ where: { role: "agent_media_buyer", status: "Active" } })
    : [];

  const designLeaders = await prisma.user.findMany({ 
    where: { role: { in: ["leader_graphic_designer", "leader_motion_graphic", "leader_ui"] }, status: "Active" } 
  });

  // Calculate KPIs
  const kpis = {
    totalClients: projects.length,
    activeClients: projects.filter(p => ["in_progress", "setup"].includes(p.projectStatus)).length,
    pendingClients: projects.filter(p => p.projectStatus === "new" || p.projectStatus === "assigned").length,
    delayedTasks: projects.flatMap(p => p.tasks).filter(t => t.status !== "done" && t.deadline && new Date(t.deadline) < new Date()).length,
    activeWarnings: projects.filter(p => p.warnings.some(w => !w.acknowledgedBy?.includes(user.id))).length
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isTL ? "Media Buying Leader Dashboard" : "My Media Buying Campaigns"}</h1>
      <SocialMediaClient
        projects={projects}
        agents={agents}
        designLeaders={designLeaders}
        kpis={kpis}
        userRole={user.role}
        userId={user.id}
        departmentTaskType="media_buying"
      />
    </div>
  );
}
