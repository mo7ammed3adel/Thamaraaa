import { handleLiveKitWebhook } from "@/server/chat/callService";
import { errorJson, successJson } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LiveKit's room events. Outside the session middleware: LiveKit signs each
 * call with the API secret (Authorization header carries a JWT with the
 * body's hash), which handleLiveKitWebhook verifies before acting.
 */
export async function POST(request: Request) {
  // Refuse oversized bodies before reading them.
  const declared = Number(request.headers.get("content-length") || "0");
  if (!Number.isFinite(declared) || declared > 64 * 1024) return errorJson("Too large", 413);
  const body = await request.text();
  if (body.length > 64 * 1024) return errorJson("Too large", 413);
  const result = await handleLiveKitWebhook(body, request.headers.get("authorization"));
  if (result.status === "forbidden") return errorJson("Invalid signature", 401);
  if (result.status === "not_found") return errorJson("Not found", 404);
  return successJson({ ok: true });
}
