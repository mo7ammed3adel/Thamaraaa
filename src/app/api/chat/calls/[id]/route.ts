import { getCallInfo } from "@/server/chat/callService";
import { requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — who is calling and from where, for the incoming-call card. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await getCallInfo(auth.actor, params.id), (r) => r.call);
}
