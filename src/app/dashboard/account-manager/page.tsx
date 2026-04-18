import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AccountManagerClient from "./AccountManagerClient";

export const metadata = {
  title: "Account Manager Dashboard - Thamaraa CRM",
};

export default async function AccountManagerPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  const user = session.user;
  if (!["super_admin", "head_account_manager", "account_manager"].includes(user.role)) {
    redirect("/dashboard");
  }

  // Fetch projects assigned to this account manager
  const projects = await prisma.project.findMany({
    where: {
      accountManagerId: user.id
    },
    include: {
      deal: {
        include: { 
          lead: { 
            include: { 
              callLogs: { include: { agent: true }, orderBy: { createdAt: "asc" } },
              meetings: { include: { teleAgent: true, salesAgent: true }, orderBy: { createdAt: "asc" } }
            } 
          } 
        }
      },
      tasks: {
        include: { leader: true, agent: true }
      },
      accountManager: true,
      headTechnical: { select: { id: true, name: true } },
      headSeo: { select: { id: true, name: true } },
      teamAssignments: {
        where: { status: "active" },
        include: { user: { select: { id: true, name: true, role: true } } },
      },
      globalNotes: true,
      logs: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch Head SEO users for distribution
  const headSeoUsers = await prisma.user.findMany({
    where: { role: "head_seo", status: "Active" },
    include: {
      seoProjects: {
        where: { projectStatus: { in: ["new", "setup", "in_progress", "assigned", "delayed"] } }
      }
    }
  });

  // Fetch warnings for these projects
  const projectIds = projects.map(p => p.id);
  const leadIds = projects.map(p => p.deal?.leadId).filter(Boolean);

  const warnings = await prisma.warning.findMany({
    where: {
      OR: [
        { projectId: { in: projectIds } },
        { clientId: { in: leadIds as string[] } }
      ]
    }
  });

  const projectsWithWarnings = projects.map(p => ({
    ...p,
    warnings: warnings.filter(w => w.projectId === p.id || w.clientId === p.deal?.leadId)
  }));

  // Calculate KPIs based on the specifications
  const activeClients = projectsWithWarnings.filter((p) => ["new", "setup", "in_progress", "assigned"].includes(p.projectStatus)).length;
  const clientsWithWarnings = projectsWithWarnings.filter((p) => p.warnings.length > 0).length;
  
  // Extract all tasks for this AM
  const allTasks = projectsWithWarnings.flatMap(p => p.tasks);
  const tasksInProgress = allTasks.filter(t => t.status === "in_progress").length;
  const tasksDelayed = allTasks.filter(t => {
    if (t.status === "done" || !t.deadline) return false;
    return new Date(t.deadline) < new Date();
  }).length;
  
  // Completed this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const tasksDoneThisWeek = allTasks.filter(t => t.status === "done" && t.completedAt && new Date(t.completedAt) > oneWeekAgo).length;

  // Map Head SEO users for DistributeModal format
  const headSeoForModal = headSeoUsers.map(hs => ({
    id: hs.id,
    name: hs.name,
    role: hs.role,
    managedProjects: hs.seoProjects || [],
  }));

  return (
    <AccountManagerClient 
      userId={user.id} 
      projects={projectsWithWarnings}
      headSeoUsers={headSeoForModal}
      kpis={{
        activeClients,
        clientsWithWarnings,
        tasksInProgress,
        tasksDelayed,
        tasksDoneThisWeek
      }}
    />
  );
}
