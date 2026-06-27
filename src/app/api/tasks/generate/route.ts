import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { generateProjectTasks } from "@/server/services/taskWorkflowService";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return errorJson("Unauthorized", 403);

    const result = await generateProjectTasks({
      userId: user.id,
      userRole: user.role || "",
      body: await req.json(),
    });

    if (result.status === "missing_project_id") return errorJson("projectId is required", 400);
    if (result.status === "project_forbidden") return errorJson("Forbidden: you are not on this project", 403);
    if (result.status === "unsupported_sub_task_type") return errorJson("Unsupported sub-task type", 400);
    if (result.status === "parent_task_invalid") {
      return errorJson("Parent task does not belong to this project", 400);
    }
    if (result.status === "sub_task_forbidden") {
      return errorJson("Forbidden: you cannot create a sub-task from this task", 403);
    }
    if (result.status === "sub_task_leader_missing") {
      return errorJson(`Active ${result.label} leader is required`, 400);
    }
    if (result.status === "sub_task_created") {
      return successJson({ success: true, subTask: result.subTask }, 201);
    }
    if (result.status === "generator_role_forbidden") {
      return errorJson("Forbidden: your role cannot generate project tasks", 403);
    }
    if (result.status === "project_not_found") return errorJson("Project not found", 404);
    if (result.status === "package_not_found") return errorJson("Package mapping not found", 400);
    if (result.status === "none_created_existing") {
      return successJson({ success: true, count: 0, skippedExisting: result.skippedExisting }, 200);
    }
    if (result.status === "none_created") {
      return errorJson("No tasks generated. Check package services and active leaders.", 400, {
        missingLeaders: result.missingLeaders,
      });
    }

    return successJson(
      {
        success: true,
        count: result.count,
        skippedExisting: result.skippedExisting,
        missingLeaders: result.missingLeaders,
      },
      201
    );
  } catch (error) {
    console.error(error);
    return errorJson("Internal Server Error", 500);
  }
}
