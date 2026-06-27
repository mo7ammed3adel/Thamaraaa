import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson } from "@/server/http/responses";
import { buildCommissionsExport, getDefaultCommissionMonth } from "@/server/services/financeService";

const FINANCE_ROLES = ["super_admin", "accountant"];

/**
 * GET /api/finance/commissions/export?month=YYYY-MM
 * Streams an .xlsx with one row per agent.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !FINANCE_ROLES.includes(user.role || "")) {
    return errorJson("Forbidden", 403);
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || getDefaultCommissionMonth();
  const buffer = await buildCommissionsExport(month);

  // The DOM lib's BodyInit doesn't strictly recognise Node Buffer, but at runtime
  // Buffer extends Uint8Array and is a valid stream input. Casting via unknown silences
  // the TS lib mismatch without changing runtime behaviour.
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="commissions-${month}.xlsx"`,
    },
  });
}
