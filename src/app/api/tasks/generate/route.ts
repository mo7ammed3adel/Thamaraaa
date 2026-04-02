import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (userRole !== "account_manager" && userRole !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { projectId } = await req.json();

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { accountManager: true }
    });

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const pkg = await prisma.package.findUnique({ where: { name: project.package }});
    if (!pkg) return NextResponse.json({ error: "Package mapping not found" }, { status: 400 });

    const services = JSON.parse(pkg.servicesJson);
    const tasksToCreate = [];
    const notificationsToCreate = [];

    // Find Leaders
    const allLeaders = await prisma.user.findMany({ where: { role: "team_leader", status: "Active" } });
    const seoLeaderId = allLeaders.find(l => l.name.toLowerCase().includes("seo"))?.id || allLeaders[0]?.id;
    const socialLeaderId = allLeaders.find(l => l.name.toLowerCase().includes("social"))?.id || allLeaders[0]?.id;
    const mediaLeaderId = allLeaders.find(l => l.name.toLowerCase().includes("media"))?.id || allLeaders[0]?.id;

    const seoChecklist = JSON.stringify([
      { id: "seo1", title: "Keyword Research & Strategy", completed: false },
      { id: "seo2", title: "On-Page Optimization", completed: false },
      { id: "seo3", title: "Technical Audit & Fixes", completed: false },
      { id: "seo4", title: "Backlink Setup", completed: false }
    ]);

    const socialChecklist = JSON.stringify([
      { id: "sm1", title: "Competitor Analysis", completed: false },
      { id: "sm2", title: "Content Calendar Creation", completed: false },
      { id: "sm3", title: "Prepare Design Assets", completed: false },
      { id: "sm4", title: "Schedule Initial Posts", completed: false }
    ]);

    const mediaChecklist = JSON.stringify([
      { id: "mb1", title: "Audience Targeting Research", completed: false },
      { id: "mb2", title: "Pixel & Tracking Setup", completed: false },
      { id: "mb3", title: "Ad Campaign Launch", completed: false },
      { id: "mb4", title: "A/B Testing & Optimization", completed: false }
    ]);

    if (services.includes("seo") && seoLeaderId) {
        tasksToCreate.push({
          projectId, leaderId: seoLeaderId, taskType: "SEO",
          checklistItems: seoChecklist, deadline: project.finalDeadline || new Date(Date.now() + 7 * 86400000)
        });
        notificationsToCreate.push({ userId: seoLeaderId, title: "New Assignment", message: `SEO tasks generated for project.`, link: "/dashboard/operations" });
    }

    if (services.includes("social") && socialLeaderId) {
        tasksToCreate.push({
          projectId, leaderId: socialLeaderId, taskType: "Social_Media",
          checklistItems: socialChecklist, deadline: project.finalDeadline || new Date(Date.now() + 5 * 86400000)
        });
        notificationsToCreate.push({ userId: socialLeaderId, title: "New Assignment", message: `Social tasks generated for project.`, link: "/dashboard/operations" });
    }

    if (services.includes("media") && mediaLeaderId) {
        tasksToCreate.push({
          projectId, leaderId: mediaLeaderId, taskType: "Media_Buyer",
          checklistItems: mediaChecklist, deadline: project.finalDeadline || new Date(Date.now() + 5 * 86400000)
        });
        notificationsToCreate.push({ userId: mediaLeaderId, title: "New Assignment", message: `Media tasks generated for project.`, link: "/dashboard/operations" });
    }

    if (tasksToCreate.length === 0) return NextResponse.json({ error: "No leaders available or no services mapped" }, { status: 400 });

    await prisma.task.createMany({ data: tasksToCreate });
    await prisma.notification.createMany({ data: notificationsToCreate });

    await prisma.project.update({
        where: { id: projectId },
        data: { projectStatus: "assigned" }
    });

    await prisma.projectLog.create({
        data: {
            projectId: projectId,
            action: "assigned",
            details: `Services assigned to ${tasksToCreate.length} leaders.`,
            userId: (session?.user as any)?.id
        }
    });

    return NextResponse.json({ success: true, count: tasksToCreate.length }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
