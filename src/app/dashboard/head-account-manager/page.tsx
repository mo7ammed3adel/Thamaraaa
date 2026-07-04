import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LIFECYCLE_STATE } from "@/lib/constants";
import HeadAccountManagerClient from "./HeadAccountManagerClient";

export default async function HeadAccountManagerPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user || !["super_admin", "head_account_manager"].includes(user.role)) {
    redirect("/dashboard");
  }

  // Head Account Managers only see clients the super_admin assigned to them.
  const projectScope = user.role === "head_account_manager" ? { headAccountManagerId: user.id } : {};

  const projects = await prisma.project.findMany({
    where: projectScope,
    include: {
      deal: {
        include: {
          lead: {
            include: {
              callLogs: { include: { agent: true }, orderBy: { createdAt: "asc" } },
              meetings: { include: { teleAgent: true, salesAgent: true }, orderBy: { createdAt: "asc" } },
              deals: { include: { salesAgent: true }, orderBy: { createdAt: "asc" } }
            }
          },
          salesAgent: true,
          installments: { orderBy: { dueDate: "asc" } },
        }
      },
      tasks: { include: { leader: true, agent: true } },
      accountManager: true,
      headAccountManager: { select: { id: true, name: true } },
      headTechnical: true,
      headSeo: true,
      teamAssignments: {
        where: { status: "active" },
        include: { user: { select: { id: true, name: true, role: true } } },
      },
      files: { orderBy: { createdAt: "desc" } },
      globalNotes: { orderBy: { createdAt: "desc" } },
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

  // For the super_admin to distribute clients to a specific Head Account Manager.
  const headAccountManagers = await prisma.user.findMany({
    where: { role: "head_account_manager", status: "Active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const headTechnicals = await prisma.user.findMany({
    where: { role: "head_technical", status: "Active" },
    include: {
      technicalProjects: {
        where: { projectStatus: { in: ["new", "setup", "in_progress", "assigned", "delayed"] } }
      }
    }
  });

  const headSeoUsers = await prisma.user.findMany({
    where: { role: "head_seo", status: "Active" },
    include: {
      seoProjects: {
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
  const activeLifecycleCount = projectsWithData.filter(p => p.lifecycleState === LIFECYCLE_STATE.ACTIVE).length;
  const churnRiskCount = projectsWithData.filter(p => p.lifecycleState === LIFECYCLE_STATE.HOLD || p.lifecycleState === LIFECYCLE_STATE.LOST).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newClientsToday = projectsWithData.filter(p => new Date(p.createdAt) >= today).length;

  const totalProgress = projectsWithData.reduce((acc, p) => acc + ((p.seoProgress + p.socialMediaProgress + p.mediaBuyerProgress) / 3), 0);
  const avgCompletionRate = projectsWithData.length > 0 ? Math.round(totalProgress / projectsWithData.length) : 0;

  const headTechnicalsForModal = headTechnicals.map(ht => ({
    id: ht.id,
    name: ht.name,
    role: ht.role,
    managedProjects: ht.technicalProjects || [],
  }));

  const headSeoForModal = headSeoUsers.map(hs => ({
    id: hs.id,
    name: hs.name,
    role: hs.role,
    managedProjects: hs.seoProjects || [],
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Head Account Manager Dashboard</h1>
      <HeadAccountManagerClient
        projects={projectsWithData}
        accountManagers={accountManagers}
        headAccountManagers={headAccountManagers}
        currentUserRole={user.role}
        headTechnicals={headTechnicalsForModal}
        headSeoUsers={headSeoForModal}
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
