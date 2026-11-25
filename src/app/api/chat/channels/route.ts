import { browseChannels } from "@/server/chat/chatService";
import { requireChatActor } from "@/server/chat/routeHelpers";
import { successJson } from "@/server/http/responses";

export const dynamic = "force-dynamic";

/** GET — public channels anyone can join. */
export async function GET() {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return successJson(await browseChannels(auth.actor));
}
