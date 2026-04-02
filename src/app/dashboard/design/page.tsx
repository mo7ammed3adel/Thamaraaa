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
      ? { OR: [{ leaderId: user.id }, { taskType: { contains: taskType } }] }
      : { agentId: user.id },
    include: {
      project: { include: { deal: { include: { lead: { include: { callLogs: { include: { agent: true } }, meetings: { include: { salesAgent: true } } } } } } } },
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

  const teamLabel = team === "graphic" ? "Graphic Design" : team === "motion" ? "Motion Graphics" : "UI/UX Design";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{teamLabel} {isLeader ? "Queue" : "Tasks"}</h1>
      <DesignClient tasks={tasks} agents={agents} userRole={user.role} userId={user.id} teamLabel={teamLabel} />
    </div>
  );
}
