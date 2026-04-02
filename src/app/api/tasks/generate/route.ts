import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await req.json();
    const { projectId, packageType, parentTaskId, brief, deadline, priority } = body;

    // Cross-team sub-task creation (from agent → design team leader)
    if (parentTaskId) {
      const leaderId = body.graphicLeaderId || body.motionLeaderId || body.uiLeaderId || body.seoLeaderId;
      if (!leaderId) return NextResponse.json({ error: "Leader ID required for sub-task" }, { status: 400 });

      const taskType = packageType || "graphic_design";
      const defaultChecklist = JSON.stringify([
        { id: "st1", title: "Review Brief & Requirements", completed: false },
        { id: "st2", title: "Create Initial Draft", completed: false },
        { id: "st3", title: "Internal Review", completed: false },
        { id: "st4", title: "Final Delivery", completed: false },
      ]);

      const subTask = await prisma.task.create({
        data: {
          projectId,
          leaderId,
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
          userId: leaderId,
          title: "New Design Request",
          message: `${user.role.replace(/_/g, " ")} requested: ${taskType.replace(/_/g, " ")}${brief ? ` — ${brief.substring(0, 50)}` : ""}`,
          type: "task_assigned",
          link: "/dashboard/design",
        },
      });

      return NextResponse.json({ success: true, subTask }, { status: 201 });
    }

    // Standard project task generation (from Account Manager)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { accountManager: true },
    });

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const pkg = await prisma.package.findUnique({ where: { name: project.package } });
    if (!pkg) return NextResponse.json({ error: "Package mapping not found" }, { status: 400 });

    const services = JSON.parse(pkg.servicesJson);
    const tasksToCreate: any[] = [];
    const notificationsToCreate: any[] = [];

    // Try new role-based leaders first, fallback to legacy "team_leader"
    const newLeaders = await prisma.user.findMany({
      where: {
        role: { in: ["team_leader_seo", "head_seo", "team_leader_social_media", "team_leader_media_buyer", "team_leader"] },
        status: "Active",
      },
    });

    const seoLeaderId = body.seoLeaderId || newLeaders.find((l) => ["team_leader_seo", "head_seo"].includes(l.role))?.id || newLeaders.find((l) => l.name.toLowerCase().includes("seo"))?.id || newLeaders[0]?.id;
    const socialLeaderId = body.socialLeaderId || newLeaders.find((l) => l.role === "team_leader_social_media")?.id || newLeaders.find((l) => l.name.toLowerCase().includes("social"))?.id || newLeaders[0]?.id;
    const mediaLeaderId = body.mediaLeaderId || newLeaders.find((l) => l.role === "team_leader_media_buyer")?.id || newLeaders.find((l) => l.name.toLowerCase().includes("media"))?.id || newLeaders[0]?.id;

    const seoChecklist = JSON.stringify([
      { id: "seo1", title: "Keyword Research & Strategy", completed: false },
      { id: "seo2", title: "On-Page Optimization", completed: false },
      { id: "seo3", title: "Technical Audit & Fixes", completed: false },
      { id: "seo4", title: "Backlink Setup", completed: false },
    ]);

    const socialChecklist = JSON.stringify([
      { id: "sm1", title: "Competitor Analysis", completed: false },
      { id: "sm2", title: "Content Calendar Creation", completed: false },
      { id: "sm3", title: "Prepare Design Assets", completed: false },
      { id: "sm4", title: "Schedule Initial Posts", completed: false },
    ]);

    const mediaChecklist = JSON.stringify([
      { id: "mb1", title: "Audience Targeting Research", completed: false },
      { id: "mb2", title: "Pixel & Tracking Setup", completed: false },
      { id: "mb3", title: "Ad Campaign Launch", completed: false },
      { id: "mb4", title: "A/B Testing & Optimization", completed: false },
    ]);

    const defaultDeadline = project.finalDeadline || new Date(Date.now() + 7 * 86400000);

    if (services.includes("seo") && seoLeaderId) {
      tasksToCreate.push({
        projectId, leaderId: seoLeaderId, taskType: "SEO",
        checklistItems: seoChecklist, deadline: defaultDeadline,
        requesterRole: user.role, assignedRole: "seo", status: "pending", priority: "Medium",
      });
      notificationsToCreate.push({ userId: seoLeaderId, title: "New Assignment", message: `SEO tasks generated for project.`, link: "/dashboard/seo" });
    }

    if (services.includes("social") && socialLeaderId) {
      tasksToCreate.push({
        projectId, leaderId: socialLeaderId, taskType: "Social_Media",
        checklistItems: socialChecklist, deadline: defaultDeadline,
        requesterRole: user.role, assignedRole: "social_media", status: "pending", priority: "Medium",
      });
      notificationsToCreate.push({ userId: socialLeaderId, title: "New Assignment", message: `Social tasks generated for project.`, link: "/dashboard/social-media" });
    }

    if (services.includes("media") && mediaLeaderId) {
      tasksToCreate.push({
        projectId, leaderId: mediaLeaderId, taskType: "Media_Buyer",
        checklistItems: mediaChecklist, deadline: defaultDeadline,
        requesterRole: user.role, assignedRole: "media_buying", status: "pending", priority: "Medium",
      });
      notificationsToCreate.push({ userId: mediaLeaderId, title: "New Assignment", message: `Media tasks generated for project.`, link: "/dashboard/media-buyer" });
    }

    if (tasksToCreate.length === 0) return NextResponse.json({ error: "No leaders available or no services mapped" }, { status: 400 });

    await prisma.task.createMany({ data: tasksToCreate });
    await prisma.notification.createMany({ data: notificationsToCreate });

    await prisma.project.update({
      where: { id: projectId },
      data: { projectStatus: "assigned" },
    });

    await prisma.projectLog.create({
      data: {
        projectId,
        action: "assigned",
        details: `Services assigned to ${tasksToCreate.length} leaders.`,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, count: tasksToCreate.length }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
