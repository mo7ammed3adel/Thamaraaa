import { deleteLabel, updateLabel } from "@/server/chat/labels";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

/** PATCH { name?, color? } — rename or recolour one of your labels. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await updateLabel(auth.actor, params.id, { name: body.name, color: body.color }));
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await deleteLabel(auth.actor, params.id));
}
