import { toggleReaction } from "@/server/chat/chatService";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

/** POST — { emoji } toggles your reaction. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await toggleReaction(auth.actor, params.id, body.emoji), (r) => r.message);
}
