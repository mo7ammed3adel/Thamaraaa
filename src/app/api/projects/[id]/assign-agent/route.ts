import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { assignProjectAgent } from "@/server/services/projectDistributionService";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user?.id || !user.role) return unauthorizedJson();

    const result = await assignProjectAgent({
      projectId: params.id,
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      body: await req.json(),
    });

    if (result.status === "role_not_allowed") return errorJson("Forbidden: role not allowed", 403);
    if (result.status === "missing_fields") return errorJson("agentUserId and department are required", 400);
    if (result.status === "unknown_department") return errorJson(`Unknown department: ${result.department}`, 400);
    if (result.status === "target_not_found") return errorJson("Target user not found or inactive", 404);
    if (result.status === "cannot_distribute") {
      return errorJson(`Your role (${user.role}) cannot distribute to ${result.targetRole}`, 403);
    }
    if (result.status === "cannot_receive_department") {
      return errorJson(`${result.targetRole} cannot receive ${result.department} tasks`, 400);
    }
    if (result.status === "project_not_found") return errorJson("Project not found", 404);
    if (result.status === "project_manage_forbidden") {
      return errorJson("Forbidden: you are not assigned to manage this project", 403);
    }

    return successJson({ success: true, assignment: result.assignment, tasksUpdated: result.tasksUpdated });
  } catch (error: any) {
    console.error("Assign agent error:", error);
    return errorJson(error.message || "Internal server error", 500);
  }
}
