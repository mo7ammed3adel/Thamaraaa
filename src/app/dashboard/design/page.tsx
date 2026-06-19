import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DesignClient from "./DesignClient";

export default async function DesignPage({ searchParams }: { searchParams: { team?: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  const designRoles = [
    "leader_graphic_designer", "agent_graphic_designer",
    "leader_motion_graphic", "agent_motion_graphic",
    "leader_ui", "agent_ui",
    "super_admin",
  ];

  if (!designRoles.includes(user?.role)) {
    redirect("/dashboard");
  }

  const isLeader = user.role.startsWith("leader_") || user.role === "super_admin";
  const team = searchParams.team || "graphic"; // graphic, motion, ui

  // Determine task type filter based on team
  const taskTypeMap: Record<string, string> = {
    graphic: "graphic_design",
    motion: "motion_graphic",
    ui: "ui_design",
  };
  const taskType = taskTypeMap[team] || "graphic_design";

  const tasks = await prisma.task.findMany({
    where: isLeader
      ? { leaderId: user.id }
      : { agentId: user.id },
    include: {
      project: {
        include: {
          deal: { include: { lead: true } },
          accountManager: true,
          globalNotes: {
            where: { category: { in: ["telesales", "sales", "account_manager", "technical", "social_media", "media_buyer", "seo", "general"] } },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          warnings: {
            where: { status: { not: "Resolved" } },
            include: { sender: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      leader: true,
      agent: true,
      parentTask: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const agents = isLeader
    ? await prisma.user.findMany({
        where: {
          role: team === "graphic" ? "agent_graphic_designer" : team === "motion" ? "agent_motion_graphic" : "agent_ui",
          status: "Active",
        },
      })
    : [];

  // Fetch cross-team tasks for Design agents
  let crossTeamTasks: any[] = [];
  if (!isLeader) {
    const projectIds = Array.from(new Set(tasks.map((t: any) => t.projectId).filter(Boolean)));
    if (projectIds.length > 0) {
      crossTeamTasks = await prisma.task.findMany({
        where: {
          projectId: { in: projectIds },
          agentId: { not: user.id },
        },
        include: {
          agent: { select: { id: true, name: true, role: true } },
          leader: { select: { id: true, name: true, role: true } },
          project: {
            select: {
              id: true,
              deal: { select: { lead: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  const teamLabel = team === "graphic" ? "Graphic Design" : team === "motion" ? "Motion Graphics" : "UI/UX Design";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{teamLabel} {isLeader ? "Queue" : "Tasks"}</h1>
      <DesignClient tasks={tasks} agents={agents} userRole={user.role} userId={user.id} teamLabel={teamLabel} crossTeamTasks={crossTeamTasks} />
    </div>
  );
}
