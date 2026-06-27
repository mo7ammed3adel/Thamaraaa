import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { createProjectTask, listTasksForUser } from "@/server/services/taskWorkflowService";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user?.id || !user.role) return unauthorizedJson();

    const result = await createProjectTask({
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      body: await req.json(),
    });

    if (result.status === "role_forbidden") return errorJson("Forbidden: your role cannot create tasks", 403);
    if (result.status === "missing_project_or_task_type") return errorJson("projectId and taskType are required", 400);
    if (result.status === "invalid_task_link") return errorJson("taskLink must be a valid http(s) URL", 400);
    if (result.status === "project_forbidden") return errorJson("Forbidden: you are not on this project", 403);
    if (result.status === "leader_not_found") {
      return errorJson(
        `Cannot find a leader for task type "${result.taskType}". Please ensure a leader with the correct role exists in the system.`,
        400
      );
    }

    return successJson({ success: true, task: result.task });
  } catch (error: any) {
    console.error("Failed to create task:", error);
    return errorJson("Internal server error", 500);
  }
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user?.id || !user.role) return unauthorizedJson();

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    const result = await listTasksForUser({
      userId: user.id,
      userRole: user.role,
      projectId,
    });

    if (result.status === "forbidden") return errorJson("Forbidden", 403);

    return successJson({ tasks: result.tasks });
  } catch (error: any) {
    return errorJson("Internal server error", 500);
  }
}
