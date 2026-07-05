export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { changeOwnPassword } from "@/server/services/userService";

// Any logged-in user can set a new password for themselves; clears the
// must-change-password flag (used by the forced first-login flow).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const body = await req.json().catch(() => null);

  try {
    const result = await changeOwnPassword({ userId: user.id, newPassword: body?.newPassword });
    if (result.status === "too_short") {
      return errorJson("New password must be at least 6 characters", 400);
    }
    return successJson({ success: true });
  } catch (e: unknown) {
    console.error("Change password error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
