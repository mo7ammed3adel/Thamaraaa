import { getUnreadTotal } from "@/server/chat/chatService";
import { requireChatActor } from "@/server/chat/routeHelpers";
import { successJson } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireChatActor();
  if ("response" in auth) return successJson({ unread: 0 });
  return successJson({ unread: await getUnreadTotal(auth.actor) });
}
