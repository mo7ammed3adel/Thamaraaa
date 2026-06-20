import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkProjectBlockers, backfillReceiptsForNewMember } from "@/lib/distribution";
import { normalizeWebUrl } from "@/lib/safe-url";

const TASK_AGENT_ROLE_MAP: Record<string, string[]> = {
  SEO: ["agent_seo"],
  seo: ["agent_seo"],
  content_seo: ["agent_content_seo"],
  Social_Media: ["agent_social_media"],
  social_media: ["agent_social_media"],
  Media_Buyer: ["agent_media_buyer"],
  media_buyer: ["agent_media_buyer"],
  media_buying: ["agent_media_buyer"],
  graphic_design: ["agent_graphic_designer"],
  motion_graphic: ["agent_motion_graphic"],
  ui_design: ["agent_ui"],
};

function normalizeDeliverableFiles(value: unknown) {
  if (value === null || value === "") return { value: null };

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { error: "files must be valid JSON" };
    }
  }

  if (!Array.isArray(parsed)) return { error: "files must be an array" };
  if (parsed.length > 50) return { error: "files cannot contain more than 50 links" };

  const normalized = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") return { error: "Invalid file entry" };
    const entry = item as { label?: unknown; url?: unknown };
    const safeUrl = normalizeWebUrl(entry.url);
    if (!safeUrl) return { error: "Each deliverable URL must be a valid http(s) URL" };
    const label = typeof entry.label === "string" && entry.label.trim() ? entry.label.trim().slice(0, 120) : "Deliverable";
    normalized.push({ label, url: safeUrl });
  }

  return { value: JSON.stringify(normalized) };
}

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
      select: {
        id: true,
        leaderId: true,
        agentId: true,
        projectId: true,
        taskType: true,
        startedAt: true,
        project: { select: { accountManagerId: true, headTechnicalId: true, headSeoId: true } },
      },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const isAdmin =
      ["super_admin", "head_account_manager"].includes(user.role) ||
      (user.role === "head_technical" && existingTask.project?.headTechnicalId === user.id) ||
      (user.role === "head_seo" && existingTask.project?.headSeoId === user.id);
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

      if (body.agentId !== null) {
        const agent = await prisma.user.findUnique({ where: { id: body.agentId }, select: { role: true, status: true } });
        if (agent) {
          if (agent.status !== "Active") {
            return NextResponse.json({ error: "Selected agent is inactive." }, { status: 400 });
          }

          const allowedRoles = TASK_AGENT_ROLE_MAP[existingTask.taskType] || [];
          if (allowedRoles.length > 0 && !allowedRoles.includes(agent.role)) {
            return NextResponse.json(
              { error: `${agent.role} cannot receive ${existingTask.taskType.replace(/_/g, " ")} tasks.` },
              { status: 400 }
            );
          }

          const deptMap: Record<string, string> = {
            agent_seo: "seo", agent_content_seo: "content_seo",
            agent_social_media: "social_media", agent_media_buyer: "media_buyer",
            agent_graphic_designer: "graphic_design", agent_motion_graphic: "motion_graphic",
            agent_ui: "ui_design",
          };
          const dept = deptMap[agent.role];
          if (dept) {
            await prisma.teamAssignment.upsert({
              where: { projectId_userId: { projectId: existingTask.projectId, userId: body.agentId } },
              update: { status: "active" },
              create: {
                projectId: existingTask.projectId,
                userId: body.agentId,
                assignedByUserId: user.id,
                role: agent.role,
                department: dept,
              },
            });
            // Backfill any unresolved warnings so the new agent sees the blocking popup
            await backfillReceiptsForNewMember(existingTask.projectId, body.agentId);
          }
        }
      }
    }

    // Only admins can reassign leaders
    if (body.leaderId !== undefined) {
      if (!isAdmin) {
        return NextResponse.json({ error: "Only admins can reassign team leaders." }, { status: 403 });
      }
      updateData.leaderId = body.leaderId;
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

      if (body.status === "done" && isAssignedAgent && !isTeamLeader && !isAdmin && !isProjectAM) {
        return NextResponse.json({ error: "Submit the task for review before it can be marked done." }, { status: 403 });
      }

      if (["in_progress", "review", "done"].includes(body.status)) {
        const blockers = await checkProjectBlockers(existingTask.projectId);
        if (blockers.isBlocked) {
          return NextResponse.json({ 
            error: "Action blocked by unresolved project warnings.", 
            warnings: blockers.warnings 
          }, { status: 403 });
        }
      }

      updateData.status = body.status;
      // Record when the agent actually started working
      if (body.status === "in_progress" && !existingTask.startedAt) {
        updateData.startedAt = new Date();
      }
      if (body.status === "done" && body.completedAt === undefined) {
        updateData.completedAt = new Date();
      }
    }
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.brief !== undefined) updateData.brief = body.brief;
    if (body.deadline !== undefined) updateData.deadline = body.deadline ? new Date(body.deadline) : null;
    if (body.files !== undefined) {
      const normalizedFiles = normalizeDeliverableFiles(body.files);
      if ("error" in normalizedFiles) {
        return NextResponse.json({ error: normalizedFiles.error }, { status: 400 });
      }
      updateData.files = normalizedFiles.value;
    }
    if (body.completedAt !== undefined) updateData.completedAt = body.completedAt ? new Date(body.completedAt) : null;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: { project: true },
    });

    // ── Notify agent + log the assignment ──
    if (body.agentId !== undefined && body.agentId !== null) {
      await prisma.notification.create({
        data: {
          userId: body.agentId,
          title: "New Task Assigned",
          message: `A team leader assigned a new project task to your queue.`,
          link: "/dashboard/operations",
        },
      });
      await prisma.projectLog.create({
        data: {
          projectId: existingTask.projectId,
          action: "task_assigned",
          details: `${existingTask.taskType.replace(/_/g, " ")} task assigned to an agent.`,
          userId: user.id,
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

    // ── Notify the team leader (and AM) when a task is submitted for review ──
    if (body.status === "review") {
      const reviewTargets = [
        updatedTask.leaderId && updatedTask.leaderId !== user.id && {
          userId: updatedTask.leaderId,
          title: "Task Ready for Review",
          message: `Task "${updatedTask.taskType.replace(/_/g, " ")}" was submitted for your review.`,
          type: "task_review",
          link: "/dashboard/operations",
        },
        updatedTask.project?.accountManagerId && updatedTask.project.accountManagerId !== user.id && {
          userId: updatedTask.project.accountManagerId,
          title: "Task Ready for Review",
          message: `Task "${updatedTask.taskType.replace(/_/g, " ")}" was submitted for review.`,
          type: "task_review",
          link: "/dashboard/operations",
        },
      ].filter(Boolean);
      if (reviewTargets.length > 0) {
        await prisma.notification.createMany({ data: reviewTargets as any });
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
