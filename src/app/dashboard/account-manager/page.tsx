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

  const user = session.user as any;
  if (!["super_admin", "head_account_manager", "account_manager"].includes(user.role)) {
    redirect("/dashboard");
  }

  // Fetch projects assigned to this account manager
  // If super_admin or head_account_manager visits, they might see their own assigned projects if they have any,
  // or we could fetch all projects. But strictly, Account Manager view is "My Clients".
  const projects = await prisma.project.findMany({
    where: {
      accountManagerId: user.id
    },
    include: {
      deal: {
        include: { lead: true }
      },
      tasks: {
        include: { leader: true, agent: true }
      },
      accountManager: true,
      globalNotes: true,
      logs: true
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate KPIs based on the specifications
  const activeClients = projects.filter((p) => ["new", "setup", "in_progress", "assigned"].includes(p.projectStatus)).length;
  
  // Extract all tasks for this AM
  const allTasks = projects.flatMap(p => p.tasks);
  const tasksInProgress = allTasks.filter(t => t.status === "in_progress").length;
  const tasksDelayed = allTasks.filter(t => {
    if (t.status === "done" || !t.deadline) return false;
    return new Date(t.deadline) < new Date();
  }).length;
  
  // Completed this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const tasksDoneThisWeek = allTasks.filter(t => t.status === "done" && t.completedAt && new Date(t.completedAt) > oneWeekAgo).length;

  return (
    <AccountManagerClient 
      userId={user.id} 
      projects={projects}
      kpis={{
        activeClients,
        tasksInProgress,
        tasksDelayed,
        tasksDoneThisWeek
      }}
    />
  );
}
