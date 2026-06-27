import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { createProjectSetupFromDeal } from "@/server/services/projectLifecycleService";

/**
 * POST /api/projects/setup
 * Manual recovery endpoint: creates a project for a closed deal that does not yet
 * have one. The happy path now creates the project inside POST /api/deals; this
 * route remains as an idempotent fallback for legacy/orphaned deals.
 * The project starts UNASSIGNED — the Head Account Manager distributes it.
 *
 * Body: { dealId: string, niche?: string, deadline?: string }
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user?.id) return errorJson("Unauthorized", 403);

    const result = await createProjectSetupFromDeal({
      userId: user.id,
      userRole: user.role,
      body: await request.json(),
    });

    if (result.status === "forbidden") {
      return errorJson("Forbidden: only the closing Sales Agent can create a project from a deal", 403);
    }
    if (result.status === "missing_deal_id") return errorJson("Deal ID is required", 400);
    if (result.status === "duplicate") {
      return errorJson("A project already exists for this deal", 409, { project: result.project });
    }
    if (result.status === "deal_not_found") return errorJson("Deal not found", 404);
    if (result.status === "deal_forbidden") {
      return errorJson("Forbidden: this deal is not assigned to you", 403);
    }

    return successJson(result.project, 201);
  } catch (error) {
    console.error("Failed to setup project:", error);
    return errorJson("Internal Server Error", 500);
  }
}

