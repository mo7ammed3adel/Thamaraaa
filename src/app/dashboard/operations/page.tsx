import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OperationsClient from "./OperationsClient";

export default async function OperationsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  const allowedRoles = [
    "super_admin", "head_account_manager", "account_manager", 
    "head_technical", "head_seo", "team_leader_seo", "agent_seo", "agent_content_seo",
    "team_leader_social_media", "agent_social_media", "team_leader_media_buyer", "agent_media_buyer",
    "leader_graphic_designer", "agent_graphic_designer", "leader_motion_graphic", "agent_motion_graphic", "leader_ui", "agent_ui"
  ];

  if (!user || !allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  // Fetch projects: AM sees their own, Head/Super/Technical sees all
  const whereClause = ["super_admin", "head_account_manager", "head_technical"].includes(user.role) 
    ? {} 
    : user.role === "account_manager" ? { accountManagerId: user.id }
    : {}; // For regular technical staff, maybe show all projects? Or projects assigned to them. Let's just show all for simplicity.

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      deal: { 
        include: { 
          lead: { 
            include: { 
              callLogs: { include: { agent: true }, orderBy: { createdAt: "asc" } },
              meetings: { include: { teleAgent: true, salesAgent: true }, orderBy: { createdAt: "asc" } }
            } 
          }, 
          salesAgent: true 
        } 
      },
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
