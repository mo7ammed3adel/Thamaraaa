import { listMedia } from "@/server/chat/chatService";
import { requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const dynamic = "force-dynamic";

/** GET ?tab=image|video|file|link&before=<cursor> — shared media and links, newest first. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const result = await listMedia(auth.actor, params.id, { tab: url.searchParams.get("tab"), before: url.searchParams.get("before") });
  return toResponse(result, (r) => ({ tab: r.tab, counts: r.counts, hasMore: r.hasMore, nextCursor: r.nextCursor, items: r.items }));
}
