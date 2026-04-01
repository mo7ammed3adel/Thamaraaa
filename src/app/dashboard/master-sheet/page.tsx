import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MasterSheetClient from "./MasterSheetClient";
import { ListTodo } from "lucide-react";

export default async function MasterSheetPage() {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Master Sheet aggregates full Lead journey
  const leads = await prisma.lead.findMany({
    include: {
      teleAgent: { select: { name: true } },
      salesAgent: { select: { name: true } },
      callLogs: { orderBy: { createdAt: "desc" } },
      meetings: { orderBy: { createdAt: "desc" } },
      deals: {
        include: {
          projects: { include: { accountManager: { select: { name: true } } } }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 500
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <ListTodo className="mr-3 text-blue-600 w-6 h-6" /> 
          Global Master Sheet
        </h1>
      </div>
      <p className="text-gray-600 mb-6">A 360-degree view of all leads and their entire lifecycle touchpoints across the ERP system.</p>
      
      <MasterSheetClient leads={leads} />
    </div>
  );
}
