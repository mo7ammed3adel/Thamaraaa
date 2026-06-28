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

  // T032: Data fetching based on user role
  let projects: any[] = [];
  let teamMembers: any[] = [];
  let contentAgents: any[] = [];

  if (["super_admin", "head_seo"].includes(user.role)) {
    projects = await prisma.project.findMany({
      where: user.role === "super_admin" ? {} : { headSeoId: user.id },
      include: {
        deal: { include: { lead: true } },
        accountManager: { select: { id: true, name: true } },
        headSeo: { select: { id: true, name: true } },
        teamAssignments: {
          where: { status: "active" },
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        globalNotes: {
          where: { category: { in: ["telesales", "sales", "account_manager", "technical", "seo", "content_seo", "general"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        warnings: {
          where: { status: { not: "Resolved" } },
          include: { sender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "desc" },
        },
        tasks: {
          include: {
            leader: { select: { id: true, name: true, role: true } },
            agent: { select: { id: true, name: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    teamMembers = await prisma.user.findMany({
      where: { role: "team_leader_seo", status: "Active" },
      include: { _count: { select: { teamAssignments: { where: { status: "active" } } } } },
    });
    // Content SEO agents the Head SEO distributes content tasks to.
    contentAgents = await prisma.user.findMany({
      where: { role: "agent_content_seo", status: "Active" },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
  } else if (user.role === "team_leader_seo") {
    projects = await prisma.project.findMany({
      where: { teamAssignments: { some: { userId: user.id, status: "active" } } },
      include: {
        deal: { include: { lead: true } },
        accountManager: { select: { id: true, name: true } },
        headSeo: { select: { id: true, name: true } },
        teamAssignments: {
          where: { status: "active" },
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        globalNotes: {
          where: { category: { in: ["telesales", "sales", "account_manager", "technical", "seo", "content_seo", "general"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        warnings: {
          where: { status: { not: "Resolved" } },
          include: { sender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "desc" },
        },
        tasks: {
          include: {
            leader: { select: { id: true, name: true, role: true } },
            agent: { select: { id: true, name: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    teamMembers = await prisma.user.findMany({
      where: { role: { in: ["agent_seo", "agent_content_seo"] }, status: "Active" },
      include: { _count: { select: { teamAssignments: { where: { status: "active" } } } } },
    });
  } else if (["agent_seo", "agent_content_seo"].includes(user.role)) {
    try {
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
          headSeo: { select: { id: true, name: true } },
          teamAssignments: {
            where: { status: "active" },
            include: { user: { select: { id: true, name: true, role: true } } },
          },
          globalNotes: {
            where: { category: { in: ["telesales", "sales", "account_manager", "technical", "seo", "content_seo", "general"] } },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          warnings: {
            where: { status: { not: "Resolved" } },
            include: { sender: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: "desc" },
          },
          tasks: {
            where: { agentId: user.id },
            include: {
              leader: { select: { id: true, name: true, role: true } },
              agent: { select: { id: true, name: true, role: true } },
            },
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

        for (const project of projects) {
          (project as any).crossTeamTasks = otherTeamsTasks.filter(
            (t: any) => t.projectId === project.id
          );
        }
      }
    } catch (err: any) {
      return <div className="p-8"><h1 className="text-red-500 font-bold">Fetch Error:</h1><p>{err.message}</p></div>;
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {user.role === "head_seo" ? "SEO Department" : user.role === "team_leader_seo" ? "SEO Team Leader" : "My SEO Tasks"}
      </h1>
      <SeoClient projects={projects} teamMembers={teamMembers} contentAgents={contentAgents} userRole={user.role} userId={user.id} />
    </div>
  );
}
