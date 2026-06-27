import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { resolveWarningForUser } from "@/server/services/warningService";

/**
 * POST /api/warnings/[id]/resolve
 * Marks a warning as Resolved. Only the original sender can resolve their own warning.
 * Sets resolvedAt timestamp and resolvedByUserId, plus updates status to "Resolved".
 * Creates a ProjectLog entry for audit trail.
 *
 * @param req - The incoming request (no body required)
 * @param params.id - The warning ID to resolve
 * @returns 200 with updated warning on success
 * @returns 401 if not authenticated
 * @returns 403 if the user is not the warning sender
 * @returns 404 if warning not found
 * @returns 400 if warning is already resolved
 * @returns 500 on internal server error
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedJson();

    const result = await resolveWarningForUser({
      warningId: params.id,
      userId: user.id,
      userName: user.name || user.id,
    });

    if (result.status === "not_found") return errorJson("Warning not found", 404);
    if (result.status === "already_resolved") return errorJson("Warning is already resolved", 400);
    if (result.status === "forbidden") return errorJson("Only the warning creator can resolve this warning", 403);

    return successJson({ success: true, warning: result.warning });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Resolve Warning Error:", message);
    return errorJson("Internal Server Error", 500, { details: message });
  }
}
