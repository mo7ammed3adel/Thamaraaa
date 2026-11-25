import { deleteMessage, editMessage } from "@/server/chat/chatService";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

/** PATCH — { body } edits your own text message. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await editMessage(auth.actor, params.id, body.body), (r) => r.message);
}

/** DELETE — your own message, or any message if you moderate the group/channel. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await deleteMessage(auth.actor, params.id));
}
