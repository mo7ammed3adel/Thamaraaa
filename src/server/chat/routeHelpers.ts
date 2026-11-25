import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import type { ChatActor } from "./chatService";

/**
 * Resolves the employee behind a chat request.
 *
 * - The account is re-read from the database on every call, so someone who is
 *   deactivated loses chat access immediately, not when their JWT expires.
 * - Chat is closed during super-admin impersonation: impersonating is for
 *   seeing someone's dashboard, not for reading their private messages or
 *   talking as them.
 */
export async function requireChatActor(): Promise<{ actor: ChatActor } | { response: Response }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { response: errorJson("Unauthorized", 401) };
  if (session.user.impersonatedBy) return { response: errorJson("Chat is unavailable while impersonating", 403) };

  const user = await getActiveSessionUser(session.user);
  if (!user) return { response: errorJson("Unauthorized", 401) };
  return { actor: { id: user.id, name: user.name, role: user.role } };
}

type ServiceResult = { status: string; error?: string; [key: string]: unknown };

/** Maps a service's status union to an HTTP response. */
export function toResponse(result: ServiceResult, pick?: (r: ServiceResult) => unknown) {
  switch (result.status) {
    case "ok":
      return successJson(pick ? pick(result) : { ok: true });
    case "not_found":
      return errorJson("Not found", 404);
    case "forbidden":
      return errorJson("Forbidden", 403);
    case "rate_limited":
      return errorJson("Too many requests — slow down a little", 429);
    case "rejected_file":
      return errorJson("File rejected", 422, { fileName: result.fileName, reason: result.reason });
    default:
      return errorJson(result.error ?? "Invalid request", 400);
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
