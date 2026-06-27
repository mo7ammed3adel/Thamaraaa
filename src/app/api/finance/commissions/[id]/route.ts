import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { editCommission } from "@/server/services/financeService";

const FINANCE_ROLES = ["super_admin", "accountant"];

/**
 * PATCH /api/finance/commissions/[id]
 * Body: {
 *   bonuses?: BonusItem[],
 *   deductions?: DeductionItem[],
 *   finalized?: boolean
 * }
 *
 * - bonuses/deductions persist as JSON strings.
 * - netPayout is auto-recomputed from baseSalary + commissionAmount + bonuses − deductions.
 * - finalized commissions can be set finalized=true once and cannot be unfinalized
 *   (matches the spec's payout-once intent).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !FINANCE_ROLES.includes(user.role || "")) {
    return errorJson("Forbidden", 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid JSON body", 400);
  }

  try {
    const result = await editCommission({ id: params.id, body });
    if (result.status === "not_found") return errorJson("Commission not found", 404);
    if (result.status === "finalized_locked") return errorJson("Finalized commission cannot be edited", 409);
    if (result.status === "no_fields") return errorJson("No editable fields supplied", 400);
    return successJson({ success: true, commission: result.commission });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Commission PATCH error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}
