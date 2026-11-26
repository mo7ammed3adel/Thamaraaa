import { leaveCall } from "@/server/chat/callService";
import { requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await leaveCall(auth.actor, params.id));
}
