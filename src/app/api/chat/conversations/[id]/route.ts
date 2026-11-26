import { getConversation, updateConversation } from "@/server/chat/chatService";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";
import { activeCallFor, callsConfigured } from "@/server/chat/callService";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const result = await getConversation(auth.actor, params.id);
  if (result.status !== "ok") return toResponse(result);
  // Membership is checked above, so only members learn about a live call.
  const activeCall = await activeCallFor(params.id).catch((e) => {
    console.error("Active call lookup failed:", e);
    return null;
  });
  return toResponse(result, () => ({ ...result.conversation, callsEnabled: callsConfigured, activeCall }));
}

/** PATCH — { name?, description? } (owner/admin only). */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await updateConversation(auth.actor, params.id, await readJson(request)));
}
