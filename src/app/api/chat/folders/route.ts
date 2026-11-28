import { createFolder, listFolders } from "@/server/chat/folders";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const dynamic = "force-dynamic";

/** GET — your folders in every section, with their conversations in order. */
export async function GET() {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await listFolders(auth.actor), (r) => r.folders);
}

/** POST { section, name, color } — a new personal folder in one section. */
export async function POST(request: Request) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await createFolder(auth.actor, { section: body.section, name: body.name, color: body.color }), (r) => r.folder);
}
