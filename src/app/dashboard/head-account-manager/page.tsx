import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HeadAccountManagerClient from "./HeadAccountManagerClient";

export default async function HeadAccountManagerPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user || !["super_admin", "head_account_manager"].includes(user.role)) {
    redirect("/dashboard");
  }

  const projects = await prisma.project.findMany({
    include: {
      deal: { 
        include: { 
          lead: { 
            include: { 
              callLogs: { include: { agent: true }, orderBy: { createdAt: "asc" } },
              meetings: { include: { teleAgent: true, salesAgent: true }, orderBy: { createdAt: "asc" } }
            } 
          } 
        } 
      },
      tasks: { include: { leader: true, agent: true } },
      accountManager: true,
      logs: { orderBy: { createdAt: "desc" } },
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

  const headTechnicals = await prisma.user.findMany({
    where: { role: "head_technical", status: "Active" },
    include: {
      technicalProjects: {
        where: { projectStatus: { in: ["new", "setup", "in_progress", "assigned", "delayed"] } }
      }
    }
  });

  // Warnings
  const projectIds = projects.map(p => p.id);
  const leadIds = projects.map(p => p.deal?.leadId).filter(Boolean);

  const warnings = await prisma.warning.findMany({
    where: {
      OR: [
        { projectId: { in: projectIds } },
        { clientId: { in: leadIds as string[] } }
      ]
    }
  });

  const projectsWithData = projects.map(p => ({
    ...p,
    warnings: warnings.filter(w => w.projectId === p.id || w.clientId === p.deal?.leadId)
  }));

  // KPIs
  const activeCount = projectsWithData.filter((p) => ["in_progress", "setup", "new", "assigned"].includes(p.projectStatus)).length;
  const delayedCount = projectsWithData.filter((p) => p.projectStatus === "delayed").length;
  const completedCount = projectsWithData.filter((p) => p.projectStatus === "completed").length;
  const unassignedCount = projectsWithData.filter((p) => !p.accountManagerId).length;
  const clientsWithWarningsCount = projectsWithData.filter(p => p.warnings.length > 0).length;
  const onboardingCount = projectsWithData.filter(p => p.lifecycleState === "onboarding").length;
  const activeLifecycleCount = projectsWithData.filter(p => p.lifecycleState === "active").length;
  const churnRiskCount = projectsWithData.filter(p => p.lifecycleState === "churn_risk").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newClientsToday = projectsWithData.filter(p => new Date(p.createdAt) >= today).length;

  const totalProgress = projectsWithData.reduce((acc, p) => acc + ((p.seoProgress + p.socialMediaProgress + p.mediaBuyerProgress) / 3), 0);
  const avgCompletionRate = projectsWithData.length > 0 ? Math.round(totalProgress / projectsWithData.length) : 0;

  // Map headTechnicals for DistributeModal format (with managedProjects for workload)
  const headTechnicalsForModal = headTechnicals.map(ht => ({
    id: ht.id,
    name: ht.name,
    role: ht.role,
    managedProjects: ht.technicalProjects || [],
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Head Account Manager Dashboard</h1>
      <HeadAccountManagerClient
        projects={projectsWithData}
        accountManagers={accountManagers}
        headTechnicals={headTechnicalsForModal}
        kpis={{
          total: projectsWithData.length,
          active: activeCount,
          delayed: delayedCount,
          completed: completedCount,
          unassigned: unassignedCount,
          warnings: clientsWithWarningsCount,
          newToday: newClientsToday,
          avgCompletion: avgCompletionRate
        }}
        userId={user.id}
      />
    </div>
  );
}
