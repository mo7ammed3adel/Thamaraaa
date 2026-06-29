import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LeadsImportClient from "./LeadsImportClient";

export default async function LeadsImportPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "tele_sales_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  // Fetch tele-sales agents for assignment dropdown
  const agents = await prisma.user.findMany({
    where: {
      role: "tele_sales_agent",
      status: "Active",
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload Leads</h1>
      <p className="text-sm text-gray-500 mb-6">
        Import leads from advertising campaign Excel sheets into the CRM system.
      </p>
      <LeadsImportClient agents={agents} companies={companies} />
    </div>
  );
}
