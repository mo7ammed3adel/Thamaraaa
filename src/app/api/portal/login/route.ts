import { errorJson, successJson } from "@/server/http/responses";
import { setClientSessionCookie } from "@/server/auth/clientSession";
import { loginClient } from "@/server/services/clientPortalService";

/**
 * POST /api/portal/login
 * Signs a customer into the client portal. Excluded from the employee auth
 * middleware; it issues its own cookie and never touches the NextAuth session.
 * Body: { username: string, password: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await loginClient({ username: body?.username, password: body?.password });

    if (result.status === "locked") {
      return errorJson(
        `تم إيقاف المحاولات مؤقتًا بعد محاولات دخول كتير. حاول تاني بعد ${result.minutesRemaining} دقيقة.`,
        429
      );
    }
    if (result.status === "invalid") {
      return errorJson("اسم المستخدم أو كلمة المرور غير صحيحة", 401);
    }

    setClientSessionCookie(result.session);
    return successJson({ success: true, mustChangePassword: result.mustChangePassword });
  } catch (error) {
    console.error("Client portal login failed:", error);
    return errorJson("Internal server error", 500);
  }
}
