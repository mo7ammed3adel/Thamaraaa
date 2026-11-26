import { startOrJoinCall } from "@/server/chat/callService";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { video? } — start this conversation's call, or join the live one. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await startOrJoinCall(auth.actor, params.id, await readJson(request)), (r) => r.join);
}
