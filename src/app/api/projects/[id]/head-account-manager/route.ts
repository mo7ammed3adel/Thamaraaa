export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { assignHeadAccountManager } from "@/server/services/projectLifecycleService";

// Super-admin assigns (or clears) the Head Account Manager for a project/client.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  if (user.role !== "super_admin") return errorJson("Forbidden", 403);

  const body = await req.json().catch(() => null);
  const headAccountManagerId: string | null = body?.headAccountManagerId || null;

  try {
    const result = await assignHeadAccountManager({ projectId: params.id, headAccountManagerId });
    if (result.status === "invalid_head") {
      return errorJson("Invalid head account manager", 400);
    }
    return successJson({ success: true, project: result.project });
  } catch (e: unknown) {
    console.error("Assign head account manager error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
