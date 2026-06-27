import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { assignProjectRole } from "@/server/services/projectDistributionService";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user?.id || !user.role) return unauthorizedJson();

  try {
    const result = await assignProjectRole({
      projectId: params.id,
      userId: user.id,
      userRole: user.role,
      body: await req.json(),
    });

    if (result.status === "missing_fields") return errorJson("targetRole and assigneeId required", 400);
    if (result.status === "cannot_assign") {
      return errorJson(`Your role (${user.role}) cannot assign ${result.targetRole}`, 403);
    }
    if (result.status === "invalid_assignee") return errorJson("Invalid assignee for this role", 400);
    if (result.status === "project_not_found") return errorJson("Project not found", 404);
    if (result.status === "own_account_manager_forbidden") return errorJson("You can only assign your own projects", 403);
    if (result.status === "own_head_technical_forbidden") {
      return errorJson("You can only assign projects assigned to you as Head Technical", 403);
    }
    if (result.status === "own_head_seo_forbidden") {
      return errorJson("You can only assign projects assigned to you as Head SEO", 403);
    }
    if (result.status === "unsupported_role") return errorJson("Unsupported targetRole", 400);

    return successJson({ success: true, project: result.project });
  } catch (err) {
    console.error(err);
    return errorJson("Server error", 500);
  }
}
