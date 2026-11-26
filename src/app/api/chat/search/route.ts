import { searchMessages } from "@/server/chat/chatService";
import { requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const dynamic = "force-dynamic";

/** GET ?q= — messages matching the text, across the caller's conversations only. */
export async function GET(request: Request) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const result = await searchMessages(auth.actor, new URL(request.url).searchParams.get("q"));
  return toResponse(result, (r) => r.hits);
}
