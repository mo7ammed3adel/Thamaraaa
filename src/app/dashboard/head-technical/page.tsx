import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HeadTechnicalClient from "./HeadTechnicalClient";

export default async function HeadTechnicalPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "head_technical"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const projects = await prisma.project.findMany({
    where: { projectStatus: { in: ["assigned", "in_progress", "setup"] } },
    include: {
      deal: { include: { lead: true } },
      accountManager: true,
      tasks: { include: { leader: true, agent: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch team leaders that head_technical can assign to
  const teamLeaders = await prisma.user.findMany({
    where: {
      role: { in: ["team_leader_social_media", "team_leader_media_buyer"] },
      status: "Active",
    },
  });

  const activeClients = projects.filter(p => ["in_progress", "setup"].includes(p.projectStatus)).length;
  const delayedClients = projects.filter(p => p.projectStatus === "delayed" || p.tasks.some(t => t.status !== "done" && t.deadline && new Date(t.deadline) < new Date())).length;
  
  const allTasks = projects.flatMap(p => p.tasks);
  const tasksInProgress = allTasks.filter(t => t.status === "in_progress" || t.status === "pending").length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Head Technical Dashboard</h1>
      <HeadTechnicalClient 
        projects={projects} 
        teamLeaders={teamLeaders} 
        kpis={{
          assignedClients: projects.length,
          activeClients,
          delayedClients,
          tasksInProgress,
          allTasks
        }}
        userId={user.id} 
      />
    </div>
  );
}
