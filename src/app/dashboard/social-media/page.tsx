import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TeamDashboardClient from "./TeamDashboardClient";

export default async function SocialMediaPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "team_leader_social_media", "agent_social_media"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const isTL = ["super_admin", "team_leader_social_media"].includes(user.role);

  const tasks = await prisma.task.findMany({
    where: isTL
      ? { leaderId: user.id }
      : { agentId: user.id },
    include: {
      project: { include: { deal: { include: { lead: true } }, accountManager: true } },
      leader: true,
      agent: true,
      subTasks: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const agents = isTL
    ? await prisma.user.findMany({ where: { role: "agent_social_media", status: "Active" } })
    : [];

  const designLeaders = !isTL
    ? await prisma.user.findMany({ where: { role: { in: ["leader_graphic_designer", "leader_motion_graphic"] }, status: "Active" } })
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isTL ? "Social Media Team" : "My Social Media Tasks"}</h1>
      <TeamDashboardClient
        tasks={tasks}
        agents={agents}
        designLeaders={designLeaders}
        userRole={user.role}
        userId={user.id}
        teamName="Social Media"
        teamColor="pink"
        subTaskTypes={[
          { value: "graphic_design", label: "Graphic Design", leaderRole: "leader_graphic_designer" },
          { value: "motion_graphic", label: "Motion Graphics", leaderRole: "leader_motion_graphic" },
        ]}
      />
    </div>
  );
}
