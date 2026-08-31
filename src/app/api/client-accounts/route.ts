import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { createClientAccount, getClientAccountForLead } from "@/server/services/clientAccountService";

/**
 * GET /api/client-accounts?leadId=... — the portal account for one customer.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user?.id || !user.role) return unauthorizedJson();

  const leadId = new URL(req.url).searchParams.get("leadId");
  if (!leadId) return errorJson("leadId is required", 400);

  const result = await getClientAccountForLead({
    actor: { id: user.id, role: user.role },
    leadId,
  });
  if (result.status === "forbidden") {
    return errorJson("Forbidden: you do not manage this client", 403);
  }

  return successJson({ account: result.account });
}

/**
 * POST /api/client-accounts — creates a customer's portal login.
 * Returns the one-time password once; it is never retrievable again.
 * Body: { leadId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user?.id || !user.role) return unauthorizedJson();

    const body = await req.json();
    const result = await createClientAccount({
      actor: { id: user.id, role: user.role },
      leadId: body?.leadId,
    });

    if (result.status === "missing_lead") return errorJson("leadId is required", 400);
    if (result.status === "forbidden") {
      return errorJson("Forbidden: you do not manage this client", 403);
    }
    if (result.status === "lead_not_found") return errorJson("Client not found", 404);
    if (result.status === "already_exists") {
      return errorJson("This client already has a portal account", 409, {
        account: result.account,
      });
    }

    return successJson(
      { success: true, account: result.account, temporaryPassword: result.temporaryPassword },
      201
    );
  } catch (error) {
    console.error("Failed to create client account:", error);
    return errorJson("Internal server error", 500);
  }
}
