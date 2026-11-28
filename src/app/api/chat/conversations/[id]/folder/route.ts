import { moveToFolder } from "@/server/chat/folders";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

/** PUT { folderId: string | null, beforeId? } — put this conversation in one of your folders, or take it out. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await moveToFolder(auth.actor, params.id, { folderId: body.folderId, beforeId: body.beforeId }));
}
