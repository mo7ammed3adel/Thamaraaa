import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userCanAccessProject } from "@/lib/distribution";

const STANDARD_GENERATOR_ROLES = new Set([
  "super_admin",
  "head_account_manager",
  "account_manager",
  "head_technical",
  "head_seo",
]);

const SUB_TASK_TYPES: Record<string, { leaderKeys: string[]; leaderRoles: string[]; label: string }> = {
  graphic_design: {
    leaderKeys: ["graphicLeaderId"],
    leaderRoles: ["leader_graphic_designer"],
    label: "Graphic Design",
  },
  motion_graphic: {
    leaderKeys: ["motionLeaderId"],
    leaderRoles: ["leader_motion_graphic"],
    label: "Motion Graphic",
  },
  ui_design: {
    leaderKeys: ["uiLeaderId"],
    leaderRoles: ["leader_ui"],
    label: "UI/UX",
  },
  content_seo: {
    leaderKeys: ["seoLeaderId"],
    leaderRoles: ["team_leader_seo"],
    label: "Content SEO",
  },
};

const SERVICE_CONFIG = {
  seo: {
    services: ["seo"],
    taskTypes: ["SEO", "seo"],
    assignedRole: "seo",
    bodyKeys: ["seoLeaderId"],
    leaderRoles: ["team_leader_seo", "head_seo"],
    dashboardLink: "/dashboard/seo",
    title: "SEO tasks generated for project.",
    checklist: [
      { id: "seo1", title: "Keyword Research & Strategy", completed: false },
      { id: "seo2", title: "On-Page Optimization", completed: false },
      { id: "seo3", title: "Technical Audit & Fixes", completed: false },
      { id: "seo4", title: "Backlink Setup", completed: false },
    ],
  },
  social: {
    services: ["social", "social_media"],
    taskTypes: ["Social_Media", "social_media"],
    assignedRole: "social_media",
    bodyKeys: ["socialLeaderId"],
    leaderRoles: ["team_leader_social_media"],
    dashboardLink: "/dashboard/social-media",
    title: "Social tasks generated for project.",
    checklist: [
      { id: "sm1", title: "Competitor Analysis", completed: false },
      { id: "sm2", title: "Content Calendar Creation", completed: false },
      { id: "sm3", title: "Prepare Design Assets", completed: false },
      { id: "sm4", title: "Schedule Initial Posts", completed: false },
    ],
  },
  media: {
    services: ["media", "media_buyer", "media_buying"],
    taskTypes: ["Media_Buyer", "media_buyer", "media_buying"],
    assignedRole: "media_buying",
    bodyKeys: ["mediaLeaderId", "mediaBuyerLeaderId"],
    leaderRoles: ["team_leader_media_buyer"],
    dashboardLink: "/dashboard/media-buyer",
    title: "Media tasks generated for project.",
    checklist: [
      { id: "mb1", title: "Audience Targeting Research", completed: false },
      { id: "mb2", title: "Pixel & Tracking Setup", completed: false },
      { id: "mb3", title: "Ad Campaign Launch", completed: false },
      { id: "mb4", title: "A/B Testing & Optimization", completed: false },
    ],
  },
} as const;

function getBodyLeaderId(body: any, keys: readonly string[]) {
  for (const key of keys) {
    if (typeof body[key] === "string" && body[key].trim()) return body[key].trim();
  }
  return null;
}

async function resolveLeader(candidateId: string | null, allowedRoles: readonly string[]) {
  if (candidateId) {
    const leader = await prisma.user.findUnique({
      where: { id: candidateId },
      select: { id: true, role: true, status: true },
    });
    if (!leader || leader.status !== "Active" || !allowedRoles.includes(leader.role)) {
      return null;
    }
    return leader.id;
  }

  const leader = await prisma.user.findFirst({
    where: { role: { in: [...allowedRoles] }, status: "Active" },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  return leader?.id || null;
}

function parseServices(servicesJson: string) {
  try {
    const parsed = JSON.parse(servicesJson);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await req.json();
    const { projectId, packageType, parentTaskId, brief, deadline, priority } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const projectAllowed = await userCanAccessProject(user.id, user.role, projectId);
    if (!projectAllowed) {
      return NextResponse.json({ error: "Forbidden: you are not on this project" }, { status: 403 });
    }

    // Cross-team sub-task creation (from project stakeholders to a creative/SEO leader)
    if (parentTaskId) {
      const taskType = packageType || "graphic_design";
      const subTaskConfig = SUB_TASK_TYPES[taskType];
      if (!subTaskConfig) {
        return NextResponse.json({ error: "Unsupported sub-task type" }, { status: 400 });
      }

      const parentTask = await prisma.task.findUnique({
        where: { id: parentTaskId },
        select: { id: true, projectId: true, leaderId: true, agentId: true },
      });
      if (!parentTask || parentTask.projectId !== projectId) {
        return NextResponse.json({ error: "Parent task does not belong to this project" }, { status: 400 });
      }

      const canCreateSubTask =
        user.role === "super_admin" ||
        user.role === "head_account_manager" ||
        user.role === "account_manager" ||
        parentTask.leaderId === user.id ||
        parentTask.agentId === user.id;

      if (!canCreateSubTask) {
        return NextResponse.json({ error: "Forbidden: you cannot create a sub-task from this task" }, { status: 403 });
      }

      const leaderId = getBodyLeaderId(body, subTaskConfig.leaderKeys);
      const resolvedLeaderId = await resolveLeader(leaderId, subTaskConfig.leaderRoles);
      if (!resolvedLeaderId) {
        return NextResponse.json({ error: `Active ${subTaskConfig.label} leader is required` }, { status: 400 });
      }

      const defaultChecklist = JSON.stringify([
        { id: "st1", title: "Review Brief & Requirements", completed: false },
        { id: "st2", title: "Create Initial Draft", completed: false },
        { id: "st3", title: "Internal Review", completed: false },
        { id: "st4", title: "Final Delivery", completed: false },
      ]);

      const subTask = await prisma.task.create({
        data: {
          projectId,
          leaderId: resolvedLeaderId,
          taskType,
          checklistItems: defaultChecklist,
          parentTaskId,
          requesterRole: user.role,
          assignedRole: taskType,
          brief: brief || null,
          deadline: deadline ? new Date(deadline) : null,
          priority: priority || "Medium",
          status: "pending",
        },
      });

      await prisma.notification.create({
        data: {
          userId: resolvedLeaderId,
          title: "New Design Request",
          message: `${user.role.replace(/_/g, " ")} requested: ${taskType.replace(/_/g, " ")}${brief ? ` - ${brief.substring(0, 50)}` : ""}`,
          type: "task_assigned",
          link: "/dashboard/design",
        },
      });

      return NextResponse.json({ success: true, subTask }, { status: 201 });
    }

    if (!STANDARD_GENERATOR_ROLES.has(user.role)) {
      return NextResponse.json({ error: "Forbidden: your role cannot generate project tasks" }, { status: 403 });
    }

    // Standard project task generation (from AM / head roles)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { accountManager: true },
    });

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const pkg = await prisma.package.findUnique({ where: { name: project.package } });
    if (!pkg) return NextResponse.json({ error: "Package mapping not found" }, { status: 400 });

    const services = parseServices(pkg.servicesJson);
    const existingTasks = await prisma.task.findMany({
      where: { projectId },
      select: { taskType: true },
    });
    const existingTaskTypes = new Set(existingTasks.map((task) => task.taskType));

    const tasksToCreate: any[] = [];
    const notificationsToCreate: any[] = [];
    const missingLeaders: string[] = [];
    const skippedExisting: string[] = [];
    const defaultDeadline = project.finalDeadline || new Date(Date.now() + 7 * 86400000);

    for (const [serviceName, config] of Object.entries(SERVICE_CONFIG)) {
      const serviceIncluded = config.services.some((service) => services.includes(service));
      if (!serviceIncluded) continue;

      const hasExistingTask = config.taskTypes.some((taskType) => existingTaskTypes.has(taskType));
      if (hasExistingTask) {
        skippedExisting.push(serviceName);
        continue;
      }

      const requestedLeaderId = getBodyLeaderId(body, config.bodyKeys);
      const leaderId = await resolveLeader(requestedLeaderId, config.leaderRoles);
      if (!leaderId) {
        missingLeaders.push(serviceName);
        continue;
      }

      tasksToCreate.push({
        projectId,
        leaderId,
        taskType: config.taskTypes[0],
        checklistItems: JSON.stringify(config.checklist),
        deadline: defaultDeadline,
        requesterRole: user.role,
        assignedRole: config.assignedRole,
        status: "pending",
        priority: "Medium",
      });
      notificationsToCreate.push({
        userId: leaderId,
        title: "New Assignment",
        message: config.title,
        type: "task_assigned",
        link: config.dashboardLink,
      });
    }

    if (tasksToCreate.length === 0) {
      if (skippedExisting.length > 0) {
        return NextResponse.json({ success: true, count: 0, skippedExisting }, { status: 200 });
      }
      return NextResponse.json({
        error: "No tasks generated. Check package services and active leaders.",
        missingLeaders,
      }, { status: 400 });
    }

    await prisma.task.createMany({ data: tasksToCreate });
    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({ data: notificationsToCreate });
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { projectStatus: "assigned" },
    });

    await prisma.projectLog.create({
      data: {
        projectId,
        action: "assigned",
        details: `Services assigned to ${tasksToCreate.length} leaders.${missingLeaders.length ? ` Missing leaders: ${missingLeaders.join(", ")}` : ""}`,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, count: tasksToCreate.length, skippedExisting, missingLeaders }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
