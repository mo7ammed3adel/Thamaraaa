import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SeoClient from "./SeoClient";

export default async function SeoPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "head_seo", "team_leader_seo", "agent_seo", "agent_content_seo"].includes(user?.role)) {
    redirect("/dashboard");
  }

  // Head SEO: see all SEO tasks
  // TL SEO: see tasks assigned to them as leader
  // Agent: see tasks assigned to them as agent
  const isHead = ["super_admin", "head_seo"].includes(user.role);
  const isTL = user.role === "team_leader_seo";
  const isAgent = ["agent_seo", "agent_content_seo"].includes(user.role);

  const tasks = await prisma.task.findMany({
    where: isHead
      ? { taskType: { contains: "seo" } }
      : isTL
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

  // Fetch team members for assignment
  const teamMembers = isHead
    ? await prisma.user.findMany({ where: { role: "team_leader_seo", status: "Active" } })
    : isTL
    ? await prisma.user.findMany({ where: { role: { in: ["agent_seo", "agent_content_seo"] }, status: "Active" } })
    : [];

  // Design team leaders for sub-task creation
  const designLeaders = isAgent
    ? await prisma.user.findMany({
        where: { role: { in: ["leader_graphic_designer", "leader_ui"] }, status: "Active" },
      })
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isHead ? "SEO Department" : isTL ? "SEO Team Leader" : "My SEO Tasks"}
      </h1>
      <SeoClient tasks={tasks} teamMembers={teamMembers} designLeaders={designLeaders} userRole={user.role} userId={user.id} />
    </div>
  );
}
