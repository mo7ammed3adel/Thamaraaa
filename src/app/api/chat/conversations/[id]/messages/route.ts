import { MAX_FILE_BYTES, MAX_FILES_PER_MESSAGE, MAX_UPLOAD_TOTAL_BYTES } from "@/lib/chat/constants";
import { listMessages, sendMessage, type UploadedFile } from "@/server/chat/chatService";
import { readJson, requireChatActor, toResponse } from "@/server/chat/routeHelpers";
import { errorJson } from "@/server/http/responses";
import { canAttachRecording } from "@/server/chat/callService";
import { isMediaMessageKind } from "@/lib/chat/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?before=<messageId> — a page of messages, oldest first. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const result = await listMessages(auth.actor, params.id, { before: url.searchParams.get("before") });
  return toResponse(result, (r) => ({ messages: r.messages, hasMore: r.hasMore, othersReadAt: r.othersReadAt }));
}

/**
 * POST — JSON { body?, stickerId?, replyToId? } for text and stickers, or
 * multipart/form-data with the same fields plus one or more "files".
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    const json = await readJson(request);
    // Pick fields explicitly: files only ever come from the multipart path below.
    return toResponse(
      await sendMessage(auth.actor, params.id, { body: json.body, stickerId: json.stickerId, replyToId: json.replyToId }),
      (r) => r.message
    );
  }

  // The body is buffered in memory, so its size must be known and bounded up
  // front. A chunked request has no Content-Length and is refused outright;
  // Node stops reading at the declared length, so a short claim can't smuggle more.
  const declaredHeader = request.headers.get("content-length");
  const declared = declaredHeader ? Number(declaredHeader) : NaN;
  if (!Number.isFinite(declared)) return errorJson("Content-Length required", 411);
  if (declared > MAX_UPLOAD_TOTAL_BYTES) return errorJson("Upload is too large", 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorJson("Malformed upload", 400);
  }

  const entries = form.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (entries.length > MAX_FILES_PER_MESSAGE) return errorJson(`At most ${MAX_FILES_PER_MESSAGE} files per message`, 400);
  if (entries.some((f) => f.size > MAX_FILE_BYTES)) return errorJson("File is too large", 413);

  // new Uint8Array(arrayBuffer) is a view, not a copy.
  const files: UploadedFile[] = await Promise.all(
    entries.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))
  );

  // kind=voice|recording: one recorded file plus its length and waveform.
  const kind = form.get("kind");
  const media = isMediaMessageKind(kind) ? { kind, durationMs: form.get("durationMs"), waveform: form.get("waveform") } : undefined;
  if (kind != null && !media) return errorJson("Unknown message kind", 400);
  if (media?.kind === "recording" && !(await canAttachRecording(auth.actor.id, params.id, form.get("callId")))) {
    return errorJson("Not a call you were in", 403);
  }

  const result = await sendMessage(auth.actor, params.id, {
    body: form.get("body"),
    replyToId: form.get("replyToId"),
    files,
    media,
  });
  return toResponse(result, (r) => r.message);
}
