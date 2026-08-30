import { errorJson, successJson } from "@/server/http/responses";
import { readClientSession } from "@/server/auth/clientSession";
import { changeClientPassword } from "@/server/services/clientPortalService";

/**
 * POST /api/portal/change-password
 * Lets the signed-in customer replace their password — required on first login.
 * Body: { currentPassword: string, newPassword: string }
 */
export async function POST(req: Request) {
  try {
    const session = readClientSession();
    if (!session) return errorJson("Unauthorized", 401);

    const body = await req.json();
    const result = await changeClientPassword({
      session,
      currentPassword: body?.currentPassword,
      newPassword: body?.newPassword,
    });

    if (result.status === "weak_password") {
      return errorJson(`كلمة المرور لازم تكون ${result.minLength} حروف على الأقل`, 400);
    }
    if (result.status === "not_found") return errorJson("Account not found", 404);
    if (result.status === "suspended") return errorJson("الحساب موقوف", 403);
    if (result.status === "wrong_current_password") {
      return errorJson("كلمة المرور الحالية غير صحيحة", 400);
    }

    return successJson({ success: true });
  } catch (error) {
    console.error("Client portal password change failed:", error);
    return errorJson("Internal server error", 500);
  }
}
