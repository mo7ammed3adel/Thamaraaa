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
      callLogs: {
        orderBy: { createdAt: "desc" },
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

  // Current agent status
  const agentData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { status: true }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sales Workspace</h1>
      </div>
      <SalesClient initialLeads={leads} userRole={user.role} userId={user.id} initialStatus={agentData?.status || "Active"} />
    </div>
  );
}
