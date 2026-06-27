import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { getSessionUser } from "@/server/auth/session";
import { updateProjectStatus } from "@/server/services/projectLifecycleService";

/**
 * PATCH /api/projects/[id]/status
 * Updates project status, finalStatus, or notes.
 * 
 * Security: Only the assigned account manager, head account manager,
 * or super_admin can modify a project's status.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedJson();

    const body = await request.json();
    const result = await updateProjectStatus({
      projectId: params.id,
      userId: user.id,
      userRole: user.role as string,
      userName: user.name,
      body,
    });

    if (result.status === "not_found") return errorJson("Project not found", 404);
    if (result.status === "forbidden") return errorJson("Forbidden: You are not authorized to modify this project.", 403);
    if (result.status === "invalid_status") return errorJson(`Invalid status: ${result.projectStatus}`, 400);
    if (result.status === "account_manager_forbidden") return errorJson("Only Head Account Manager can change account manager assignment.", 403);
    if (result.status === "target_account_manager_invalid") return errorJson("Target account manager not found or inactive.", 400);
    if (result.status === "blocked") {
      return errorJson("Action blocked by unresolved warnings.", 403, { warnings: result.warnings });
    }

    return successJson(result.project);
  } catch (error) {
    console.error("Failed to update project status:", error);
    return errorJson("Internal Server Error", 500);
  }
}
