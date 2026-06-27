import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { changeProjectLifecycle } from "@/server/services/projectLifecycleService";

/**
 * PATCH /api/projects/lifecycle
 * Changes a project's lifecycle state with role-based authorization and state-machine validation.
 * Body: { projectId: string, newState: string }
 * Allowed roles: account_manager (own projects only), head_account_manager, super_admin
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedJson();

    const body = await req.json();
    const { projectId, newState } = body;

    if (!projectId || !newState) {
      return errorJson("projectId and newState are required", 400);
    }

    const result = await changeProjectLifecycle({
      projectId,
      newState,
      userId: user.id,
      userRole: user.role as string,
      userName: user.name as string,
    });

    if (result.status === "not_found") return errorJson("Project not found", 404);
    if (result.status === "forbidden") {
      return errorJson("You are not authorized to change this project's lifecycle state", 403);
    }
    if (result.status === "invalid_transition") return errorJson(result.error || "Invalid transition", 422);

    return successJson({
      success: true,
      project: {
        id: result.project.id,
        lifecycleState: result.project.lifecycleState,
      },
    });
  } catch (error: unknown) {
    console.error("Lifecycle update error:", error);
    return errorJson("Internal server error", 500);
  }
}
