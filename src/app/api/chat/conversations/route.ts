import { createConversation, listConversations } from "@/server/chat/chatService";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";
import { successJson } from "@/server/http/responses";

export const dynamic = "force-dynamic";

/** GET /api/chat/conversations — the caller's DMs, groups and channels. */
export async function GET() {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return successJson(await listConversations(auth.actor));
}

/** POST /api/chat/conversations — { type: dm|group|channel, name?, description?, isPrivate?, memberIds } */
export async function POST(request: Request) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const result = await createConversation(auth.actor, await readJson(request));
  return toResponse(result, (r) => ({ id: r.id }));
}
