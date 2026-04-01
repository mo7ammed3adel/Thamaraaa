import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RecycleBinClient from "./RecycleBinClient";
import { RefreshCcw } from "lucide-react";

export default async function RecycleBinPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  
  if (!["super_admin", "sales_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  // Fetch rejected leads with the feedback left by previous agents
  const leads = await prisma.lead.findMany({
    where: { status: "Closed_Lost", archivedAt: null },
    include: {
      salesAgent: { select: { name: true } },
      // Fetch newest feedback logs specifically for the closing action
      callLogs: {
        where: { callStatus: "Closed_Lost" },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "desc" }
  });

  // Fetch active sales agents for reassignment
  const salesAgents = await prisma.user.findMany({
    where: { role: "sales_agent", status: "Active" },
    select: { id: true, name: true }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <RefreshCcw className="mr-3 text-red-500 w-6 h-6" /> 
          Recycle Bin
        </h1>
      </div>
      <p className="text-gray-600 mb-6">Review lost deals and re-assign them to a new sales agent to attempt closing another time.</p>
      
      <RecycleBinClient leads={leads} salesAgents={salesAgents} />
    </div>
  );
}

// Ensure TS recheck
