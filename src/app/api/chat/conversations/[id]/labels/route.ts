import { setConversationLabels } from "@/server/chat/labels";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

/** PUT { labelIds } — which of your labels are on this conversation. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await setConversationLabels(auth.actor, params.id, body.labelIds), (r) => ({ labelIds: r.labelIds }));
}
