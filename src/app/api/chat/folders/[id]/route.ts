import { deleteFolder, updateFolder } from "@/server/chat/folders";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

/** PATCH { name?, color? } — rename or recolour one of your folders. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await updateFolder(auth.actor, params.id, { name: body.name, color: body.color }));
}

/** DELETE — removes the folder; its conversations go back loose in the section. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await deleteFolder(auth.actor, params.id));
}
