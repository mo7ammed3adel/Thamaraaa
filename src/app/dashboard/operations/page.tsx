import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OperationsClient from "./OperationsClient";

export default async function OperationsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  
  if (!["super_admin", "head_account_manager", "account_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  // Fetch projects: AM sees their own, Head/Super sees all
  const whereClause = ["super_admin", "head_account_manager"].includes(user.role) 
    ? {} 
    : { accountManagerId: user.id };

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      deal: { include: { lead: true, salesAgent: true } },
      tasks: { include: { leader: true, agent: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  // Fetch potential assignees for AM to push tasks to
  const teamLeaders = await prisma.user.findMany({ 
    where: { 
      role: { in: ["team_leader_seo", "team_leader_social_media", "team_leader_media_buyer", "leader_graphic_designer", "leader_motion_graphic", "leader_ui"] }, 
      status: "Active" 
    } 
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Operations Hub</h1>
      <OperationsClient 
        userRole={user.role} 
        userId={user.id} 
        projects={projects}
        teamLeaders={teamLeaders}
      />
    </div>
  );
}
