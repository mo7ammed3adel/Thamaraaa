import { listUserAvatars } from "@/server/avatars/avatarService";
import { requireChatActor } from "@/server/chat/routeHelpers";
import { successJson } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — { [userId]: version } for everyone who has a profile photo. */
export async function GET() {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return successJson(await listUserAvatars());
}
