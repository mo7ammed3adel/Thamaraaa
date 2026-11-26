import { userAvatarFile } from "@/server/avatars/avatarService";
import { avatarResponse } from "@/server/avatars/avatarHttp";
import { requireChatActor } from "@/server/chat/routeHelpers";

export const runtime = "nodejs";

/** GET — a colleague's profile photo (any signed-in employee). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return avatarResponse(await userAvatarFile(params.id));
}
