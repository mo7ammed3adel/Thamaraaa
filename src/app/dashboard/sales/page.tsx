import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SalesClient from "./SalesClient";

export default async function SalesWorkspacePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  
  if (!["super_admin", "sales_manager", "sales_agent"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const allowedStatuses = ["In_Sales", "Waiting", "Follow_Up", "Rescheduled", "Closed_Won", "Closed_Lost"];
  const whereClause = user.role === "sales_agent" 
    ? { assignedSalesAgentId: user.id, status: { in: allowedStatuses } } 
    : { status: { in: allowedStatuses } };

  const leads = await prisma.lead.findMany({
    where: whereClause,
    orderBy: { createdAt: "asc" },
    include: {
      teleAgent: { select: { id: true, name: true } },
      salesAgent: { select: { id: true, name: true } },
      callLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          agent: { select: { name: true } }
        }
      },
      meetings: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  // Managers can hand meetings over manually, so they need the roster of agents
  // they may assign to — direct reports plus orphans, mirroring My Team.
  const isManagerView = ["super_admin", "sales_manager"].includes(user.role);
  const teamAgents = isManagerView
    ? await prisma.user.findMany({
        where: {
          role: "sales_agent",
          status: { not: "Inactive" },
          ...(user.role === "sales_manager"
            ? { OR: [{ directManagerId: user.id }, { directManagerId: null }] }
            : {}),
        },
        select: { id: true, name: true, status: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Current agent status
  const agentData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { status: true }
  });

  // Fetch post-sale projects (closed deals linked to this sales agent)
  const postSaleProjects = await prisma.project.findMany({
    where: user.role === "sales_agent" ? { deal: { salesAgentId: user.id } } : {},
    include: {
      deal: {
        include: { lead: true }
      },
      accountManager: { select: { name: true } },
      tasks: {
        orderBy: { createdAt: "asc" }
      },
      warnings: {
        where: { status: "Active" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sales Workspace</h1>
      </div>
      <SalesClient
        initialLeads={leads}
        userRole={user.role}
        userId={user.id}
        initialStatus={agentData?.status || "Active"}
        postSaleProjects={postSaleProjects}
        teamAgents={teamAgents}
      />
    </div>
  );
}
