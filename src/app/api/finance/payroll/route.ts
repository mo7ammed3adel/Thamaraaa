import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { getDefaultCommissionMonth, listFinancePayroll } from "@/server/services/financeService";

const FINANCE_ROLES = ["super_admin", "accountant"];

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !FINANCE_ROLES.includes(user.role || "")) {
    return errorJson("Forbidden", 403);
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || getDefaultCommissionMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return errorJson("month must be YYYY-MM", 400);
  }

  try {
    return successJson(await listFinancePayroll(month));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Finance payroll GET error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}
