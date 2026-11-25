import { getConversation, updateConversation } from "@/server/chat/chatService";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await getConversation(auth.actor, params.id), (r) => r.conversation);
}

/** PATCH — { name?, description? } (owner/admin only). */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await updateConversation(auth.actor, params.id, await readJson(request)));
}
