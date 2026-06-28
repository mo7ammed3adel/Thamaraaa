export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { listPayroll } from "@/server/services/hrService";

const HR_ROLES = ["super_admin", "hr_manager"];

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !HR_ROLES.includes(sessionUser.role || "")) {
    return errorJson("Forbidden", 403);
  }

  const { searchParams } = new URL(req.url);
  try {
    return successJson(await listPayroll({ month: searchParams.get("month") }));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR payroll GET error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}
