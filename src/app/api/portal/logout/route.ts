import { successJson } from "@/server/http/responses";
import { clearClientSessionCookie } from "@/server/auth/clientSession";

/** POST /api/portal/logout — drops the client portal cookie. */
export async function POST() {
  clearClientSessionCookie();
  return successJson({ success: true });
}
