import { setRecordingFlag } from "@/server/chat/callService";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const runtime = "nodejs";

/** POST { on: boolean } — shows or clears the red recording badge on you. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await setRecordingFlag(auth.actor, params.id, body.on));
}
