import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { assignProjectTeamSlot } from "@/server/services/projectDistributionService";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return errorJson("Unauthorized", 403);

    const result = await assignProjectTeamSlot({
      projectId: params.id,
      userId: user.id,
      userRole: user.role || "",
      userName: user.name,
      body: await req.json(),
    });

    if (result.status === "insufficient_role") return errorJson("Forbidden: insufficient role", 403);
    if (result.status === "missing_fields") {
      return errorJson("Missing required fields: department, assignedRoleType, newUserId", 400);
    }
    if (result.status === "invalid_role_type") return errorJson("assignedRoleType must be leader or agent", 400);
    if (result.status === "unknown_department") return errorJson(`Unknown department: ${result.department}`, 400);
    if (result.status === "department_forbidden") {
      return errorJson(`Your role cannot assign ${result.assignedRoleType}s for ${result.department}`, 403);
    }
    if (result.status === "target_not_found") return errorJson("Target user not found", 404);
    if (result.status === "target_role_invalid") {
      return errorJson(
        `${result.targetRole} cannot be assigned as ${result.assignedRoleType} for ${result.department}`,
        400
      );
    }
    if (result.status === "project_not_found") return errorJson("Project not found", 404);
    if (result.status === "head_technical_forbidden") {
      return errorJson("Forbidden: project is not assigned to this Head Technical", 403);
    }
    if (result.status === "head_seo_forbidden") {
      return errorJson("Forbidden: project is not assigned to this Head SEO", 403);
    }

    return successJson({
      success: true,
      message: `${result.targetUserName} assigned as ${result.assignedRoleType} for ${result.department}`,
      tasksUpdated: result.tasksUpdated,
    });
  } catch (error: any) {
    console.error("Team assignment API Error:", error);
    return errorJson(error.message || "Internal server error", 500);
  }
}
