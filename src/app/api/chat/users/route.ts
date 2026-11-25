import { searchUsers } from "@/server/chat/chatService";
import { requireChatActor } from "@/server/chat/routeHelpers";
import { successJson } from "@/server/http/responses";

export const dynamic = "force-dynamic";

/** GET ?q= — active employees by name or email, for starting chats and adding members. */
export async function GET(request: Request) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return successJson(await searchUsers(auth.actor, new URL(request.url).searchParams.get("q")));
}
