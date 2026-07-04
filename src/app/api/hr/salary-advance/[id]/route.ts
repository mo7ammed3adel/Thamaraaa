export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { decideSalaryAdvance } from "@/server/services/hrService";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const body = await req.json().catch(() => null);

  try {
    const result = await decideSalaryAdvance({ user, id: params.id, body });
    if (result.status === "forbidden") return errorJson("Forbidden", 403);
    if (result.status === "not_found") return errorJson("Request not found", 404);
    if (result.status === "cannot_approve") {
      return errorJson("Request cannot be approved from its current state", 400);
    }
    if (result.status === "not_approved_yet") {
      return errorJson("Only approved requests can be marked paid", 400);
    }
    if (result.status === "invalid_action") return errorJson("Invalid action", 400);
    return successJson({ advance: result.advance });
  } catch (e: unknown) {
    console.error("Salary advance PATCH error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
