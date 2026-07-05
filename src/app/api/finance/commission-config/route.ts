export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { updateCommissionConfig } from "@/server/services/financeService";

const FINANCE_ROLES = ["super_admin", "accountant"];

/**
 * PATCH /api/finance/commission-config — accountant (or super_admin) edits a
 * commission rate table or the gateway fee. Persists to SystemConfig and
 * immediately recomputes the current month so payouts reflect the new rates.
 * Body: { key, value } where value is a JSON string (rate table) or decimal (fee).
 */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !FINANCE_ROLES.includes(user.role || "")) {
    return errorJson("Forbidden", 403);
  }

  const body = await req.json().catch(() => null);

  try {
    const result = await updateCommissionConfig({ adminId: user.id, key: body?.key, value: body?.value });

    if (result.status === "missing_fields") {
      return errorJson("key and value (string) are required", 400);
    }
    if (result.status === "invalid_value") {
      return errorJson(result.message, 400);
    }

    return successJson({ ok: true, recomputed: result.recomputed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Commission config PATCH error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}
