import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
<<<<<<< HEAD
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
      deal: { include: { lead: true } },
      tasks: { include: { leader: true, agent: true } },
      accountManager: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const accountManagers = await prisma.user.findMany({
    where: { role: "account_manager", status: "Active" },
    include: {
      managedProjects: {
        where: { projectStatus: { in: ["new", "setup", "in_progress", "assigned", "delayed"] } }
      }
    }
  });

  // KPIs
  const activeCount = projects.filter((p) => ["in_progress", "setup", "new", "assigned"].includes(p.projectStatus)).length;
  const delayedCount = projects.filter((p) => p.projectStatus === "delayed").length;
  const completedCount = projects.filter((p) => p.projectStatus === "completed").length;
  const unassignedCount = projects.filter((p) => !p.accountManagerId).length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Head Account Manager Dashboard</h1>
      <HeadAccountManagerClient
        projects={projects}
        accountManagers={accountManagers}
        kpis={{ total: projects.length, active: activeCount, delayed: delayedCount, completed: completedCount, unassigned: unassignedCount }}
        userId={user.id}
      />
    </div>
  );
=======
import HeadAccountManagerClient from "./HeadAccountManagerClient";

export const metadata = {
  title: "Head Account Manager - Thamaraa CRM",
};

export default async function HeadAccountManagerPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any).role;
  if (role !== "super_admin" && role !== "head_account_manager") {
    redirect("/dashboard");
  }

  return <HeadAccountManagerClient />;
>>>>>>> bb12de6 (Update Head Account Manager dashboard)
}
