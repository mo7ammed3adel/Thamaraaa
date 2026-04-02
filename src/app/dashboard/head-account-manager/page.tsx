import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HeadAccountManagerClient from "./HeadAccountManagerClient";

export default async function HeadAccountManagerPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "head_account_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const projects = await prisma.project.findMany({
    include: {
      deal: { include: { lead: { include: { callLogs: { include: { agent: true } }, meetings: { include: { teleAgent: true, salesAgent: true } }, deals: { include: { salesAgent: true } } } }, salesAgent: true } },
      tasks: { include: { leader: true, agent: true, subTasks: true } },
      accountManager: true,
      logs: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const accountManagers = await prisma.user.findMany({
    where: { role: "account_manager", status: "Active" },
  });

  const warnings = await prisma.warning.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // KPIs
  const activeCount = projects.filter((p) => ["in_progress", "assigned", "setup"].includes(p.projectStatus)).length;
  const completedCount = projects.filter((p) => p.projectStatus === "completed").length;
  const onTimeCount = projects.filter((p) => p.finalDeadline && new Date(p.finalDeadline) >= new Date() && p.projectStatus !== "delayed").length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Head Account Manager Dashboard</h1>
      <HeadAccountManagerClient
        projects={projects}
        accountManagers={accountManagers}
        warnings={warnings}
        kpis={{ total: projects.length, active: activeCount, completed: completedCount, onTime: onTimeCount }}
        userId={user.id}
      />
    </div>
  );
}
