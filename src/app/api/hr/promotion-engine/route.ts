import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { applyPromotionAction, listPromotionEvaluations } from "@/server/services/hrService";

const HR_ROLES = ["super_admin", "hr_manager"];

export async function GET() {
  const user = await getSessionUser();
  if (!user || !HR_ROLES.includes(user.role || "")) {
    return errorJson("Forbidden", 403);
  }

  try {
    return successJson({ evaluations: await listPromotionEvaluations() });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Promotion engine GET error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}

export async function POST(req: NextRequest) {
  const actor = await getSessionUser();
  if (!actor || !HR_ROLES.includes(actor.role || "")) {
    return errorJson("Forbidden", 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid JSON body", 400);
  }

  const { userId, action, nextLevel, nextRole } = body || {};

  try {
    const result = await applyPromotionAction({ userId, action, nextLevel, nextRole });

    if (result.status === "missing_fields") return errorJson("userId and action are required", 400);
    if (result.status === "invalid_action") return errorJson(`Invalid action: ${result.action}`, 400);
    if (result.status === "hr_not_found") return errorJson("Employee has no HR record", 404);
    if (result.status === "promote_missing_fields") {
      return errorJson("nextLevel or nextRole required for promote", 400);
    }
    if (result.status === "warned") {
      return successJson({
        success: true,
        action: result.action,
        userId: result.userId,
        warningCount: result.warningCount,
        terminationFlag: result.terminationFlag,
      });
    }
    if (result.status === "ok") {
      return successJson({ success: true, action: result.action, userId: result.userId });
    }

    return errorJson("Unhandled action", 400);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Promotion engine POST error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}
