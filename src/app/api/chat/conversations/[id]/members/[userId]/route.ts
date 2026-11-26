import { removeMember, setMemberRole } from "@/server/chat/chatService";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";
import { removeFromLiveCalls } from "@/server/chat/callService";

type Params = { params: { id: string; userId: string } };

/** DELETE — remove someone, or leave when userId is the caller. */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const result = await removeMember(auth.actor, params.id, params.userId);
  // Out of the conversation means out of its live call, right now.
  if (result.status === "ok") await removeFromLiveCalls(params.id, params.userId).catch(() => undefined);
  return toResponse(result);
}

/** PATCH — { role: "admin" | "member" } (owner only). */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await setMemberRole(auth.actor, params.id, params.userId, body.role));
}
