import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HeadTechnicalClient from "./HeadTechnicalClient";
import { getTranslator } from "@/server/i18n/locale";

export default async function HeadTechnicalPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "head_technical"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const projects = await prisma.project.findMany({
    where: user.role === "super_admin" ? {} : { headTechnicalId: user.id },
    include: {
      deal: { include: { lead: true } },
      accountManager: true,
      headTechnical: true,
      tasks: { include: { leader: true, agent: true } },
      teamAssignments: {
        where: { status: "active" },
        include: { user: { select: { id: true, name: true, role: true } } },
      },
      warnings: {
        where: { status: { not: "Resolved" } },
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const packages = await prisma.package.findMany({
    select: { name: true, servicesJson: true },
  });

  const servicesByPackage = new Map(
    packages.map((pkg) => {
      try {
        return [pkg.name, JSON.parse(pkg.servicesJson) as string[]] as [string, string[]];
      } catch {
        return [pkg.name, [] as string[]] as [string, string[]];
      }
    })
  );

  const technicalTaskToDepartment: Record<string, string> = {
    Social_Media: "social_media",
    social_media: "social_media",
    Media_Buyer: "media_buyer",
    media_buyer: "media_buyer",
    media_buying: "media_buyer",
  };

  const projectsWithData = projects.map((project) => {
    const requiredDepartments = new Set<string>();
    const services = servicesByPackage.get(project.package) || [];

    if (services.includes("social")) requiredDepartments.add("social_media");
    if (services.includes("media")) requiredDepartments.add("media_buyer");

    project.tasks.forEach((task) => {
      const department = technicalTaskToDepartment[task.taskType];
      if (department) requiredDepartments.add(department);
    });

    return {
      ...project,
      requiredTechnicalDepartments: Array.from(requiredDepartments),
    };
  });

  // Head Technical can only distribute to Social Media + Media Buyer team leaders
  // (Head SEO is reachable through Account Manager — see DISTRIBUTION_MAP in lib/distribution.ts)
  const teamLeaders = await prisma.user.findMany({
    where: {
      role: { in: ["team_leader_social_media", "team_leader_media_buyer"] },
      status: "Active",
    },
    include: {
      _count: {
        select: { teamAssignments: { where: { status: "active" } } },
      },
    },
  });

  function hasDepartmentLeader(project: any, department: string) {
    const hasTeamAssignment = project.teamAssignments.some((assignment: any) =>
      assignment.department === department &&
      assignment.role.includes("leader")
    );
    const hasTaskLeader = project.tasks.some((task: any) =>
      technicalTaskToDepartment[task.taskType] === department &&
      Boolean(task.leaderId)
    );
    return hasTeamAssignment || hasTaskLeader;
  }

  function isTechnicalTask(task: any) {
    return Boolean(technicalTaskToDepartment[task.taskType]);
  }

  const activeClients = projectsWithData.filter(p => ["in_progress", "setup", "assigned"].includes(p.projectStatus)).length;
  const delayedClients = projectsWithData.filter(p => p.projectStatus === "delayed" || p.tasks.some(t => isTechnicalTask(t) && t.status !== "done" && t.deadline && new Date(t.deadline) < new Date())).length;
  const unassignedTechnicalLeaders = projectsWithData.filter(p =>
    p.requiredTechnicalDepartments.some((department: string) => !hasDepartmentLeader(p, department))
  ).length;
  const warningsCount = projectsWithData.reduce((acc, p) => acc + (p.warnings?.length || 0), 0);
  
  const allTasks = projectsWithData.flatMap(p => p.tasks.filter(isTechnicalTask));
  const tasksInProgress = allTasks.filter(t => t.status === "in_progress" || t.status === "pending").length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("ht.dashboardTitle")}</h1>
      <HeadTechnicalClient 
        projects={projectsWithData} 
        teamLeaders={teamLeaders} 
        kpis={{
          totalProjects: projectsWithData.length,
          assignedClients: projectsWithData.length,
          activeClients,
          delayedClients,
          unassignedTechnicalLeaders,
          warningsCount,
          tasksInProgress,
          allTasks
        }}
        userId={user.id} 
      />
    </div>
  );
}
