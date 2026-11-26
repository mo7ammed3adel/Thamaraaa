import { createLabel, listLabels } from "@/server/chat/labels";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const dynamic = "force-dynamic";

/** GET — your labels (with the conversations each is on). */
export async function GET() {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await listLabels(auth.actor), (r) => r.labels);
}

/** POST { name, color } — a new personal label. */
export async function POST(request: Request) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await createLabel(auth.actor, { name: body.name, color: body.color }), (r) => r.label);
}
