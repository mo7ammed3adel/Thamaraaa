import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { setClientAccountStatus } from "@/server/services/clientAccountService";

/**
 * PATCH /api/client-accounts/[id]/status
 * Suspends or re-activates a customer's portal access.
 * Body: { status: "Active" | "Suspended" }
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user?.id || !user.role) return unauthorizedJson();

    const body = await req.json();
    const result = await setClientAccountStatus({
      actor: { id: user.id, role: user.role },
      accountId: params.id,
      status: body?.status,
    });

    if (result.status === "invalid_status") {
      return errorJson('status must be "Active" or "Suspended"', 400);
    }
    if (result.status === "not_found") return errorJson("Account not found", 404);
    if (result.status === "forbidden") {
      return errorJson("Forbidden: you do not manage this client", 403);
    }

    return successJson({ success: true, account: result.account });
  } catch (error) {
    console.error("Failed to update client account status:", error);
    return errorJson("Internal server error", 500);
  }
}
