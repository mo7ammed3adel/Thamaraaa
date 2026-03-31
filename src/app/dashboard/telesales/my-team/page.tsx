import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MyTeamClient from "./MyTeamClient";

export default async function MyTeamPage({ searchParams }: { searchParams: any }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "tele_sales_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const from = searchParams.from;
  const to = searchParams.to;
  
  const dateFilter: any = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateFilter.lte = toDate;
  }
  const createdAtFilter = (from || to) ? { createdAt: dateFilter } : {};

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
          teleSalesLeads: { where: createdAtFilter },
          callLogs: { where: createdAtFilter },
          meetingsAsTele: { where: (from || to) ? { meetingDate: dateFilter } : {} },
        },
      },
      teleSalesLeads: {
        where: { status: "Transferred", ...createdAtFilter },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Flatten the data for the client
  const agentsWithKPI = agents.map(a => ({
    ...a,
    transferredCount: a.teleSalesLeads.length,
    teleSalesLeads: undefined, // don't send full leads array
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">My Team</h1>
      <p className="text-sm text-gray-500 mb-6">
        Manage your tele-sales agents — assign specializations and monitor team members.
      </p>
      <MyTeamClient agents={agentsWithKPI as any} initialFrom={from || ""} initialTo={to || ""} />
    </div>
  );
}
