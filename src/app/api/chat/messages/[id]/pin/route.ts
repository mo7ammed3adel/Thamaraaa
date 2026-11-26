import { togglePin } from "@/server/chat/chatService";
import { requireChatActor, toResponse } from "@/server/chat/routeHelpers";

/** POST — pins or unpins a message in its conversation. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await togglePin(auth.actor, params.id), (r) => r.message);
}
