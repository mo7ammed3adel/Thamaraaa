import { backfillProjectChats } from "@/server/chat/projectChat";
import { requireChatActor } from "@/server/chat/routeHelpers";
import { errorJson, successJson } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — super admins only: create the client group for every project that
 * was already in the technical stage before groups existed, and add everyone
 * assigned. Safe to run again (it only adds what's missing).
 */
export async function POST() {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  if (auth.actor.role !== "super_admin") return errorJson("Forbidden", 403);
  return successJson(await backfillProjectChats());
}
