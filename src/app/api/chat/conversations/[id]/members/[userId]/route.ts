import { removeMember, setMemberRole } from "@/server/chat/chatService";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

type Params = { params: { id: string; userId: string } };

/** DELETE — remove someone, or leave when userId is the caller. */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await removeMember(auth.actor, params.id, params.userId));
}

/** PATCH — { role: "admin" | "member" } (owner only). */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await setMemberRole(auth.actor, params.id, params.userId, body.role));
}
