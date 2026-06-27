import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { distributeProject } from "@/server/services/projectDistributionService";

/**
 * POST /api/projects/distribute
 * Distributes (assigns) a project to an Account Manager or Head Technical.
 * Head Account Manager assigns account_manager → updates Project.accountManagerId
 * Head Account Manager assigns head_technical → updates Project.headTechnicalId
 * Body: { projectId: string, targetUserId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user?.id || !user.role) return unauthorizedJson();

    const body = await req.json();
    const { projectId, targetUserId } = body;
    const reqHost = req.headers.get("x-forwarded-host") || req.nextUrl.host;
    const reqProtocol = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol;

    const result = await distributeProject({
      projectId,
      targetUserId,
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      taskGenerationUrl: `${reqProtocol}//${reqHost}/api/tasks/generate`,
      cookie: req.headers.get("cookie") || "",
    });

    if (result.status === "missing_fields") {
      return errorJson("projectId and targetUserId are required", 400);
    }
    if (result.status === "target_not_found") return errorJson("Target user not found or inactive", 404);
    if (result.status === "cannot_distribute") {
      return errorJson(`Your role (${user.role}) cannot distribute to ${result.targetRole}`, 403);
    }
    if (result.status === "project_not_found") return errorJson("Project not found", 404);
    if (result.status === "own_account_manager_forbidden") {
      return errorJson("You can only distribute your own projects", 403);
    }
    if (result.status === "own_head_technical_forbidden") {
      return errorJson("You can only distribute projects assigned to you as Head Technical", 403);
    }
    if (result.status === "own_head_seo_forbidden") {
      return errorJson("You can only distribute projects assigned to you as Head SEO", 403);
    }
    if (result.status === "duplicate_assignment") {
      return errorJson(`${result.targetUserName} is already assigned to this project`, 409);
    }
    if (result.status === "team_assigned") return successJson({ success: true, assignment: result.assignment });
    if (result.status === "project_assigned") return successJson({ success: true, project: result.project });

    return errorJson("No distribution rule for this role", 400);
  } catch (error: unknown) {
    console.error("Distribution error:", error);
    return errorJson("Internal server error", 500);
  }
}
