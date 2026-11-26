import { listThread } from "@/server/chat/chatService";
import { requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const dynamic = "force-dynamic";

/** GET — a thread: its root message and every reply. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await listThread(auth.actor, params.id), (r) => ({ root: r.root, replies: r.replies }));
}
