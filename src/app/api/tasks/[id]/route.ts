import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const taskId = params.id;
    const body = await req.json();

    const updateData: any = {};
    if (body.agentId !== undefined) updateData.agentId = body.agentId;
    if (body.progressPct !== undefined) updateData.progressPct = body.progressPct;
    if (body.checklistItems !== undefined) updateData.checklistItems = body.checklistItems;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: { project: true }
    });

    if (body.agentId !== undefined) {
      await prisma.notification.create({
        data: {
          userId: body.agentId,
          title: "New Task Assigned",
          message: "A team leader assigned a new project task to your queue.",
          link: "/dashboard/operations"
        }
      });
    }

    // If progress is updated, we might need to dynamically update project progress
    if (body.progressPct !== undefined) {
      const allProjectTasks = await prisma.task.findMany({ where: { projectId: updatedTask.projectId } });
      const seoTasks = allProjectTasks.filter(t => t.taskType === "SEO");
      const socialTasks = allProjectTasks.filter(t => t.taskType === "Social_Media");

      const avgSeo = seoTasks.length ? seoTasks.reduce((acc, t) => acc + t.progressPct, 0) / seoTasks.length : 0;
      const avgSocial = socialTasks.length ? socialTasks.reduce((acc, t) => acc + t.progressPct, 0) / socialTasks.length : 0;

      await prisma.project.update({
        where: { id: updatedTask.projectId },
        data: {
          seoProgress: avgSeo,
          socialMediaProgress: avgSocial
        }
      });
    }

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
