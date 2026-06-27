import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import {
  getDefaultCommissionMonth,
  listCommissions,
  recomputeCommissions,
} from "@/server/services/financeService";

const FINANCE_ROLES = ["super_admin", "accountant"];

/**
 * GET /api/finance/commissions?month=YYYY-MM — list all sales-agent commissions for a month.
 *   month defaults to the current month if omitted.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !FINANCE_ROLES.includes(user.role || "")) {
    return errorJson("Forbidden", 403);
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || getDefaultCommissionMonth();

  try {
    return successJson(await listCommissions(month));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Finance commissions GET error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}

/**
 * POST /api/finance/commissions — recompute commissions for a month.
 * Body: { month: "YYYY-MM" }
 * Skips finalized rows.
 */
export async function POST(req: NextRequest) {
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

  const { month } = body || {};
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return errorJson("month must be YYYY-MM", 400);
  }

  try {
    return successJson(await recomputeCommissions(month));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Finance commissions POST error:", msg);
    return errorJson("Internal Server Error", 500, { details: msg });
  }
}
