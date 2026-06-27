import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { updateTask } from "@/server/services/taskWorkflowService";

/**
 * PATCH /api/tasks/[id]
 * Updates task fields (agent, progress, status, checklist, etc.)
 *
 * Security: Only the task's leader, assigned agent, project account manager,
 * or admin roles can modify a task.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user?.id || !user.role) return unauthorizedJson();

    const result = await updateTask({
      taskId: params.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      body: await req.json(),
    });

    if (result.status === "not_found") return errorJson("Task not found", 404);
    if (result.status === "forbidden") {
      return errorJson("Forbidden: You are not authorized to modify this task.", 403);
    }
    if (result.status === "agent_reassign_forbidden") {
      return errorJson("Only team leaders or admins can reassign agents.", 403);
    }
    if (result.status === "agent_inactive") return errorJson("Selected agent is inactive.", 400);
    if (result.status === "agent_role_invalid") {
      return errorJson(`${result.role} cannot receive ${result.taskType.replace(/_/g, " ")} tasks.`, 400);
    }
    if (result.status === "leader_reassign_forbidden") {
      return errorJson("Only admins can reassign team leaders.", 403);
    }
    if (result.status === "invalid_progress") return errorJson("progressPct must be between 0 and 100", 400);
    if (result.status === "invalid_status") return errorJson(`Invalid status: ${result.taskStatus}`, 400);
    if (result.status === "agent_done_forbidden") {
      return errorJson("Submit the task for review before it can be marked done.", 403);
    }
    if (result.status === "blocked") {
      return errorJson("Action blocked by unresolved project warnings.", 403, {
        warnings: result.warnings,
      });
    }
    if (result.status === "invalid_files") return errorJson(result.error, 400);

    return successJson(result.task, 200);
  } catch (error) {
    console.error("Failed to update task:", error);
    return errorJson("Internal Server Error", 500);
  }
}
