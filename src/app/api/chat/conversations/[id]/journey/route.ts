import { getConversationJourney, linkConversationToProject } from "@/server/chat/journey";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — the client journey of the group's client (members only), or null. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await getConversationJourney(auth.actor, params.id), (r) => ({ journey: r.journey }));
}

/** POST { projectId | null } — owner/admin links (or unlinks) a regular group to a client. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  return toResponse(await linkConversationToProject(auth.actor, params.id, body.projectId));
}
