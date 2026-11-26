import { searchLinkableProjects } from "@/server/chat/journey";
import { requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const dynamic = "force-dynamic";

/** GET ?q= — clients you can see, to link a group to. */
export async function GET(request: Request) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await searchLinkableProjects(auth.actor, new URL(request.url).searchParams.get("q")), (r) => r.projects);
}
