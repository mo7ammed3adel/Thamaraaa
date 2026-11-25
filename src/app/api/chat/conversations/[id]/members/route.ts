import { addMembers } from "@/server/chat/chatService";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

/** POST — { userIds: string[] } */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await addMembers(auth.actor, params.id, body.userIds), (r) => ({ added: r.added }));
}
