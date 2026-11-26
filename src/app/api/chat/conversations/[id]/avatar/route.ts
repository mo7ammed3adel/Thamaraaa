import { conversationAvatarFile, removeConversationAvatar, setConversationAvatar } from "@/server/avatars/avatarService";
import { avatarError, avatarResponse, readAvatarUpload } from "@/server/avatars/avatarHttp";
import { requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const runtime = "nodejs";

type Params = { params: { id: string } };

/** GET — the group/channel photo (members only). */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return avatarResponse(await conversationAvatarFile(auth.actor, params.id));
}

/** POST multipart { file } — owners/admins set the photo. */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const upload = await readAvatarUpload(request);
  if ("response" in upload) return upload.response;
  const result = await setConversationAvatar(auth.actor, params.id, upload.bytes);
  if (result.status === "invalid") return avatarError(result.error);
  return toResponse(result, (r) => ({ version: (r as { version?: string | null }).version }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await removeConversationAvatar(auth.actor, params.id));
}
