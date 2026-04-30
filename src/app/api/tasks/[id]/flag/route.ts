import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canFlagTask } from "@/lib/distribution";

/**
 * POST /api/tasks/[id]/flag
 * Allows an assigned agent to flag/return a task to their Team Leader with a mandatory reason.
 * - Validates the user is the currently assigned agent
 * - Requires a non-empty reason string
 * - Sets flagReason, flaggedAt, flaggedByUserId
 * - Nulls the agentId (returns task to leader's queue)
 * - Reverts task status to "pending"
 * - Creates a notification for the task's leader
 *
 * @param req - JSON body: { reason: string }
 * @param params.id - The task ID to flag
 * @returns 200 with updated task on success
 * @returns 401 if not authenticated
 * @returns 403 if user is not the assigned agent
 * @returns 400 if reason is missing or empty
 * @returns 404 if task not found
 * @returns 500 on internal server error
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as { id: string; name: string; role: string };

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: { project: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!canFlagTask(user.role, task.agentId, user.id)) {
      return NextResponse.json(
        { error: "Only the assigned agent can flag this task" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required when flagging a task" },
        { status: 400 }
      );
    }

    const now = new Date();

    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: params.id },
        data: {
          flagReason: reason,
          flaggedAt: now,
          flaggedByUserId: user.id,
          agentId: null,
          status: "pending",
        },
      });

      await tx.notification.create({
        data: {
          userId: task.leaderId,
          title: "Task Flagged",
          message: `${user.name} flagged task "${task.taskType}" — Reason: ${reason}`,
          type: "task_flagged",
          relatedId: task.id,
        },
      });

      if (task.projectId) {
        await tx.projectLog.create({
          data: {
            projectId: task.projectId,
            userId: user.id,
            action: "task_flagged",
            details: `Task "${task.taskType}" flagged by ${user.name}: ${reason}`,
          },
        });
      }

      return updated;
    });

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Flag Task Error:", message);
    return NextResponse.json(
      { error: "Internal Server Error", details: message },
      { status: 500 }
    );
  }
}
