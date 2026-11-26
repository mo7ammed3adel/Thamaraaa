import { removeUserAvatar, setUserAvatar } from "@/server/avatars/avatarService";
import { avatarError, readAvatarUpload } from "@/server/avatars/avatarHttp";
import { requireChatActor, toResponse } from "@/server/chat/routeHelpers";

export const runtime = "nodejs";

/** POST multipart { file } — set your profile photo. */
export async function POST(request: Request) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const upload = await readAvatarUpload(request);
  if ("response" in upload) return upload.response;
  const result = await setUserAvatar(auth.actor, upload.bytes);
  if (result.status === "invalid") return avatarError(result.error);
  return toResponse(result, (r) => ({ version: r.version }));
}

/** DELETE — back to initials. */
export async function DELETE() {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  return toResponse(await removeUserAvatar(auth.actor));
}
