import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MediaBuyerClient from "./MediaBuyerClient";

export default async function MediaBuyerPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "team_leader_media_buyer", "agent_media_buyer"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const isTL = ["super_admin", "team_leader_media_buyer"].includes(user.role);

  let projects: any[] = [];
  let teamMembers: any[] = [];

  if (isTL) {
    projects = await prisma.project.findMany({
      where: user.role === "super_admin" ? {} : { teamAssignments: { some: { userId: user.id, status: "active" } } },
      include: {
        deal: { include: { lead: true } },
        accountManager: { select: { id: true, name: true } },
        teamAssignments: {
          where: { status: "active" },
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        tasks: { select: { id: true, status: true, taskType: true, agentId: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    teamMembers = await prisma.user.findMany({
      where: { role: "agent_media_buyer", status: "Active" },
      include: { _count: { select: { teamAssignments: { where: { status: "active" } } } } },
    });
  } else if (user.role === "agent_media_buyer") {
    projects = await prisma.project.findMany({
      where: {
        OR: [
          { teamAssignments: { some: { userId: user.id, status: "active" } } },
          { tasks: { some: { agentId: user.id } } },
        ]
      },
      include: {
        deal: { include: { lead: true } },
        accountManager: { select: { id: true, name: true } },
        tasks: {
          where: { agentId: user.id },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch cross-team tasks for the same projects (other teams' tasks)
    const projectIds = projects.map((p: any) => p.id);
    if (projectIds.length > 0) {
      const otherTeamsTasks = await prisma.task.findMany({
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

      // Attach cross-team tasks to their respective projects
      for (const project of projects) {
        (project as any).crossTeamTasks = otherTeamsTasks.filter(
          (t: any) => t.projectId === project.id
        );
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isTL ? "Media Buying Leader Dashboard" : "My Media Buying Campaigns"}</h1>
      <MediaBuyerClient
        projects={projects}
        teamMembers={teamMembers}
        userRole={user.role}
        userId={user.id}
        departmentTaskType="media_buying"
      />
    </div>
  );
}
