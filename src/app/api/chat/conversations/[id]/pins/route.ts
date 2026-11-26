import { listPinned } from "@/server/chat/chatService";
import { requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const dynamic = "force-dynamic";

/** GET — pinned messages, newest pin first. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await listPinned(auth.actor, params.id), (r) => r.messages);
}
