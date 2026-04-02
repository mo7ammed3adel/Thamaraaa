import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TeleSalesClient from "./TeleSalesClient";

export default async function TeleSalesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  
  if (!["super_admin", "tele_sales_manager", "tele_sales_agent"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const whereClause: any = user.role === "tele_sales_agent" ? { assignedTeleAgentId: user.id } : {};
  
  // Hide Draft leads from the main workspace
  whereClause.status = { not: "Draft" };

  const leads = await prisma.lead.findMany({
    where: whereClause,
    include: {
      teleAgent: { select: { name: true } },
      salesAgent: { select: { name: true } },
      callLogs: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  // Fetch custom columns with values for the leads table
  const customColumns = await prisma.customColumn.findMany({
    orderBy: { createdAt: "asc" },
    include: { values: true },
  });

  const activeAgents = await prisma.user.findMany({
    where: { role: "tele_sales_agent", status: "Active" },
    select: { id: true, name: true }
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tele-Sales Workspace</h1>
      <TeleSalesClient
        initialLeads={leads}
        userRole={user.role}
        userId={user.id}
        initialCustomColumns={customColumns}
        activeAgents={activeAgents}
      />
    </div>
  );
}
