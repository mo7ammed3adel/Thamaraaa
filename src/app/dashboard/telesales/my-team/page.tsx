import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MyTeamClient from "./MyTeamClient";

export default async function MyTeamPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "tele_sales_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  // Get agents under this manager (or all tele agents for super_admin)
  const whereClause: any = { role: "tele_sales_agent" };
  if (user.role === "tele_sales_manager") {
    whereClause.directManagerId = user.id;
  }

  const agents = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      specialization: true,
      status: true,
      level: true,
      _count: {
        select: {
          teleSalesLeads: true,
          callLogs: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">My Team</h1>
      <p className="text-sm text-gray-500 mb-6">
        Manage your tele-sales agents — assign specializations and monitor team members.
      </p>
      <MyTeamClient agents={agents} />
    </div>
  );
}
