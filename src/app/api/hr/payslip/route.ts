export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { getPayslip } from "@/server/services/hrService";

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorizedJson();

  const { searchParams } = new URL(req.url);
  try {
    const result = await getPayslip({
      sessionUserId: sessionUser.id,
      sessionUserRole: sessionUser.role,
      targetUserId: searchParams.get("userId"),
      month: searchParams.get("month"),
    });

    if (result.status === "forbidden") return errorJson("Forbidden", 403);

    return successJson(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR payslip GET error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}
