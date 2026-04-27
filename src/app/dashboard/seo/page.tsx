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

  if (["super_admin", "head_seo"].includes(user.role)) {
    projects = await prisma.project.findMany({
      where: user.role === "super_admin" ? {} : { headSeoId: user.id },
      include: {
        deal: { include: { lead: true } },
        accountManager: { select: { id: true, name: true } },
        teamAssignments: {
          where: { status: "active" },
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        tasks: { select: { id: true, status: true, taskType: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    teamMembers = await prisma.user.findMany({
      where: { role: "team_leader_seo", status: "Active" },
      include: { _count: { select: { teamAssignments: { where: { status: "active" } } } } },
    });
  } else if (user.role === "team_leader_seo") {
    projects = await prisma.project.findMany({
      where: { teamAssignments: { some: { userId: user.id, status: "active" } } },
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
          tasks: {
            where: { agentId: user.id },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (err: any) {
      return <div className="p-8"><h1 className="text-red-500 font-bold">Fetch Error:</h1><p>{err.message}</p></div>;
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {user.role === "head_seo" ? "SEO Department" : user.role === "team_leader_seo" ? "SEO Team Leader" : "My SEO Tasks"}
      </h1>
      <SeoClient projects={projects} teamMembers={teamMembers} userRole={user.role} userId={user.id} />
    </div>
  );
}
