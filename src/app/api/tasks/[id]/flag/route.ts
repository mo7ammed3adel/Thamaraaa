import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { flagTask } from "@/server/services/taskWorkflowService";

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
    const user = await getSessionUser();
    if (!user?.id || !user.role) return unauthorizedJson();

    const result = await flagTask({
      taskId: params.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      body: await req.json(),
    });

    if (result.status === "not_found") return errorJson("Task not found", 404);
    if (result.status === "forbidden") return errorJson("Only the assigned agent can flag this task", 403);
    if (result.status === "missing_reason") return errorJson("A reason is required when flagging a task", 400);

    return successJson({ success: true, task: result.task });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Flag Task Error:", message);
    return errorJson("Internal Server Error", 500, { details: message });
  }
}
