export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { reviewComplaint } from "@/server/services/hrService";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const body = await req.json().catch(() => null);

  try {
    const result = await reviewComplaint({ user, id: params.id, body });
    if (result.status === "forbidden") return errorJson("Forbidden", 403);
    if (result.status === "invalid_status") return errorJson("Invalid status", 400);
    return successJson({ complaint: result.complaint });
  } catch (e: unknown) {
    console.error("Complaint PATCH error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
