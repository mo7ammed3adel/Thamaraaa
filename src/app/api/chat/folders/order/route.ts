import { reorderFolders } from "@/server/chat/folders";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

/** PUT { section, ids } — the order of your folders in one section. */
export async function PUT(request: Request) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await reorderFolders(auth.actor, { section: body.section, ids: body.ids }));
}
