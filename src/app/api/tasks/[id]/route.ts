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
    if (body.status !== undefined) updateData.status = body.status;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.brief !== undefined) updateData.brief = body.brief;
    if (body.deadline !== undefined) updateData.deadline = body.deadline ? new Date(body.deadline) : null;
    if (body.files !== undefined) updateData.files = body.files;
    if (body.completedAt !== undefined) updateData.completedAt = body.completedAt ? new Date(body.completedAt) : null;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: { project: true },
    });

    if (body.agentId !== undefined) {
      await prisma.notification.create({
        data: {
          userId: body.agentId,
          title: "New Task Assigned",
          message: "A team leader assigned a new project task to your queue.",
          link: "/dashboard/operations",
        },
      });
    }

    // If progress is updated, dynamically update project progress
    if (body.progressPct !== undefined) {
      const allProjectTasks = await prisma.task.findMany({ where: { projectId: updatedTask.projectId } });

      const seoTasks = allProjectTasks.filter((t) => t.taskType === "SEO");
      const socialTasks = allProjectTasks.filter((t) => t.taskType === "Social_Media");
      const mediaTasks = allProjectTasks.filter((t) => t.taskType === "Media_Buyer");

      const avgSeo = seoTasks.length ? seoTasks.reduce((acc, t) => acc + t.progressPct, 0) / seoTasks.length : 0;
      const avgSocial = socialTasks.length ? socialTasks.reduce((acc, t) => acc + t.progressPct, 0) / socialTasks.length : 0;
      const avgMedia = mediaTasks.length ? mediaTasks.reduce((acc, t) => acc + t.progressPct, 0) / mediaTasks.length : 0;

      let totalActive = 0;
      let totalProgress = 0;
      if (seoTasks.length) { totalActive++; totalProgress += avgSeo; }
      if (socialTasks.length) { totalActive++; totalProgress += avgSocial; }
      if (mediaTasks.length) { totalActive++; totalProgress += avgMedia; }

      const overallProgress = totalActive > 0 ? totalProgress / totalActive : 0;
      let newStatus = updatedTask.project.projectStatus;

      if (overallProgress === 100) {
        newStatus = "completed";
      } else if (updatedTask.project.finalDeadline && new Date() > new Date(updatedTask.project.finalDeadline) && overallProgress < 100) {
        newStatus = "delayed";
      } else if (updatedTask.project.projectStatus === "setup" || updatedTask.project.projectStatus === "new") {
        newStatus = "in_progress";
      }

      await prisma.project.update({
        where: { id: updatedTask.projectId },
        data: { seoProgress: avgSeo, socialMediaProgress: avgSocial, mediaBuyerProgress: avgMedia, projectStatus: newStatus },
      });

      if (body.progressPct === 100) {
        await prisma.projectLog.create({
          data: {
            projectId: updatedTask.projectId,
            action: "progress_updated",
            details: `Task "${updatedTask.taskType}" completed by agent.`,
            userId: (session?.user as any)?.id,
          },
        });

        await prisma.notification.createMany({
          data: [
            {
              userId: updatedTask.project.accountManagerId,
              title: "Task Completed",
              message: `Task "${updatedTask.taskType}" for project was completed. Overall: ${overallProgress.toFixed(0)}%`,
              type: "task_progress",
              link: "/dashboard/operations",
            },
            {
              userId: updatedTask.leaderId,
              title: "Task Completed",
              message: `Agent completed task "${updatedTask.taskType}".`,
              type: "task_progress",
              link: "/dashboard/operations",
            },
          ],
        });
      }
    }

    // If status is updated to "done", also notify the parent task requester
    if (body.status === "done" && updatedTask.project) {
      await prisma.notification.create({
        data: {
          userId: updatedTask.project.accountManagerId,
          title: "Task Completed",
          message: `Task "${updatedTask.taskType}" has been marked as done.`,
          type: "task_progress",
          link: "/dashboard/operations",
        },
      });
    }

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
