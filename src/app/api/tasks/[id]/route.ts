import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * PATCH /api/tasks/[id]
 * Updates task fields (agent, progress, status, checklist, etc.)
 *
 * Security: Only the task's leader, assigned agent, project account manager,
 * or admin roles can modify a task.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const taskId = params.id;

    // ── Ownership / Role Check ──
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, leaderId: true, agentId: true, projectId: true, project: { select: { accountManagerId: true } } },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const isAdmin = ["super_admin", "head_account_manager", "head_technical", "head_seo"].includes(user.role);
    const isTeamLeader = existingTask.leaderId === user.id;
    const isAssignedAgent = existingTask.agentId === user.id;
    const isProjectAM = existingTask.project?.accountManagerId === user.id;

    if (!isAdmin && !isTeamLeader && !isAssignedAgent && !isProjectAM) {
      return NextResponse.json({ error: "Forbidden: You are not authorized to modify this task." }, { status: 403 });
    }

    // ── Build update payload with validation ──
    const body = await req.json();
    const updateData: any = {};

    // Only leaders and admins can reassign agents
    if (body.agentId !== undefined) {
      if (!isTeamLeader && !isAdmin) {
        return NextResponse.json({ error: "Only team leaders or admins can reassign agents." }, { status: 403 });
      }
      updateData.agentId = body.agentId;
    }

    if (body.progressPct !== undefined) {
      const pct = Number(body.progressPct);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return NextResponse.json({ error: "progressPct must be between 0 and 100" }, { status: 400 });
      }
      updateData.progressPct = pct;
    }

    if (body.checklistItems !== undefined) updateData.checklistItems = body.checklistItems;
    if (body.status !== undefined) {
      const validStatuses = ["pending", "in_progress", "review", "done"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
      }
      updateData.status = body.status;
    }
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

    // ── Notify agent on assignment ──
    if (body.agentId !== undefined) {
      await prisma.notification.create({
        data: {
          userId: body.agentId,
          title: "New Task Assigned",
          message: `A team leader assigned a new project task to your queue.`,
          link: "/dashboard/operations",
        },
      });
    }

    // ── If progress is updated, recalculate project progress ──
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

      // Notify on 100% completion
      if (body.progressPct === 100) {
        await prisma.projectLog.create({
          data: {
            projectId: updatedTask.projectId,
            action: "progress_updated",
            details: `Task "${updatedTask.taskType}" completed by ${user.name || user.id}.`,
            userId: user.id,
          },
        });

        const notificationTargets = [
          updatedTask.project.accountManagerId && {
            userId: updatedTask.project.accountManagerId,
            title: "Task Completed",
            message: `Task "${updatedTask.taskType}" completed. Overall: ${overallProgress.toFixed(0)}%`,
            type: "task_progress",
            link: "/dashboard/operations",
          },
          updatedTask.leaderId && {
            userId: updatedTask.leaderId,
            title: "Task Completed",
            message: `Agent completed task "${updatedTask.taskType}".`,
            type: "task_progress",
            link: "/dashboard/operations",
          },
        ].filter(Boolean);

        if (notificationTargets.length > 0) {
          await prisma.notification.createMany({ data: notificationTargets as any });
        }
      }
    }

    // ── Notify AM when status changes to "done" ──
    if (body.status === "done" && updatedTask.project?.accountManagerId) {
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
    console.error("Failed to update task:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
