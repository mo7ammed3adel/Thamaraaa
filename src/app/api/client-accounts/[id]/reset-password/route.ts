import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { resetClientAccountPassword } from "@/server/services/clientAccountService";

/**
 * POST /api/client-accounts/[id]/reset-password
 * Issues a new one-time password and forces the client to change it on next login.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user?.id || !user.role) return unauthorizedJson();

    const result = await resetClientAccountPassword({
      actor: { id: user.id, role: user.role },
      accountId: params.id,
    });

    if (result.status === "not_found") return errorJson("Account not found", 404);
    if (result.status === "forbidden") {
      return errorJson("Forbidden: you do not manage this client", 403);
    }

    return successJson({
      success: true,
      username: result.username,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (error) {
    console.error("Failed to reset client password:", error);
    return errorJson("Internal server error", 500);
  }
}
