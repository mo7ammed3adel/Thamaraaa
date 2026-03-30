import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OperationsClient from "./OperationsClient";

export default async function OperationsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  
  if (!["super_admin", "account_manager", "team_leader", "operations_agent"].includes(user?.role)) {
    redirect("/dashboard");
  }

  // Fetch projects for Account Manager
  const projects = await prisma.project.findMany({
    include: {
      deal: { include: { lead: true } },
      tasks: { include: { leader: true, agent: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  // Fetch tasks assigned to the current user (if leader or agent)
  const leaderTasks = await prisma.task.findMany({
    where: { leaderId: user.id },
    include: { project: { include: { deal: { include: { lead: true } } } }, agent: true }
  });

  const agentTasks = await prisma.task.findMany({
    where: { agentId: user.id },
    include: { project: { include: { deal: { include: { lead: true } } } } }
  });

  // Fetch potential assignees for AM or TL
  const teamLeaders = await prisma.user.findMany({ where: { role: "team_leader", status: "Active" } });
  const opsAgents = await prisma.user.findMany({ where: { role: "operations_agent", status: "Active" } });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Operations Hub</h1>
      <OperationsClient 
        userRole={user.role} 
        userId={user.id} 
        projects={projects}
        leaderTasks={leaderTasks}
        agentTasks={agentTasks}
        teamLeaders={teamLeaders}
        opsAgents={opsAgents}
      />
    </div>
  );
}
