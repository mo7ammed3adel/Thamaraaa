import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { reassignTask } from "@/server/services/taskWorkflowService";

/**
 * POST /api/tasks/[id]/reassign
 * Allows a Team Leader to reassign a task to a different agent within their team.
 * - Validates the user has a Team Leader role
 * - Validates the new agent exists and has an appropriate role
 * - Updates agentId to the new agent
 * - Clears any previous flag data
 * - Creates notifications for both old and new agents
 *
 * @param req - JSON body: { newAgentId: string }
 * @param params.id - The task ID to reassign
 * @returns 200 with updated task on success
 * @returns 401 if not authenticated
 * @returns 403 if user is not a Team Leader
 * @returns 400 if newAgentId is missing or agent not found
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

    const result = await reassignTask({
      taskId: params.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      body: await req.json(),
    });

    if (result.status === "not_team_leader") return errorJson("Only Team Leaders can reassign tasks", 403);
    if (result.status === "not_found") return errorJson("Task not found", 404);
    if (result.status === "not_task_leader") return errorJson("You can only reassign tasks you lead", 403);
    if (result.status === "missing_new_agent") return errorJson("newAgentId is required", 400);
    if (result.status === "agent_not_found") return errorJson("Selected agent not found or inactive", 400);
    if (result.status === "cannot_reassign_to_role") {
      return errorJson(`Your role cannot reassign tasks to ${result.role}`, 403);
    }
    if (result.status === "cannot_receive_task_type") {
      return errorJson(`${result.role} cannot receive ${result.taskType.replace(/_/g, " ")} tasks`, 400);
    }

    return successJson({ success: true, task: result.task });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Reassign Task Error:", message);
    return errorJson("Internal Server Error", 500, { details: message });
  }
}
