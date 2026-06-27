import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { createSelfTask } from "@/server/services/taskWorkflowService";

/**
 * POST /api/tasks/self
 *
 * Creates a task that is assigned to the requesting user themselves.
 * Both leaderId and agentId are set to the current user's ID.
 *
 * Required body: { projectId, brief, taskType }
 * Optional body: { priority, deadline }
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user?.id || !user.role) return unauthorizedJson();

    const result = await createSelfTask({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      body: await req.json(),
    });

    if (result.status === "role_forbidden") return errorJson("Your role is not permitted to create self-tasks", 403);
    if (result.status === "missing_project_or_brief") return errorJson("Project ID and task brief are required", 400);
    if (result.status === "missing_task_type") return errorJson("Task type is required", 400);
    if (result.status === "project_not_found") return errorJson("Project not found", 404);
    if (result.status === "project_forbidden") return errorJson("You are not assigned to this project", 403);

    return successJson({ success: true, task: result.task });
  } catch (error: any) {
    console.error("Failed to create self-task:", error);
    return errorJson("Internal server error", 500);
  }
}
