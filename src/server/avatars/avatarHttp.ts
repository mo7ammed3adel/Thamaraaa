import { createReadStream } from "fs";
import { Readable } from "stream";
import { errorJson } from "@/server/http/responses";
import { MAX_AVATAR_UPLOAD_BYTES } from "./avatarService";

/** Reads the single "file" field of a bounded multipart upload. */
export async function readAvatarUpload(request: Request): Promise<{ bytes: Uint8Array } | { response: Response }> {
  const declared = Number(request.headers.get("content-length") || "NaN");
  if (!Number.isFinite(declared)) return { response: errorJson("Content-Length required", 411) };
  if (declared > MAX_AVATAR_UPLOAD_BYTES + 64 * 1024) return { response: errorJson("Image is too large", 413) };
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { response: errorJson("Malformed upload", 400) };
  }
  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) return { response: errorJson("file is required", 400) };
  return { bytes: new Uint8Array(await file.arrayBuffer()) };
}

/**
 * Serves a stored avatar. URLs carry ?v=<version>, so a changed photo gets a
 * new URL and the old one can be cached for a day.
 */
export function avatarResponse(file: { path: string; size: number } | null): Response {
  if (!file) return errorJson("Not found", 404);
  return new Response(Readable.toWeb(createReadStream(file.path)) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(file.size),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

export const avatarError = (reason?: string) =>
  errorJson(reason === "too_large" ? "Image is too large" : "That file isn't a usable image", reason === "too_large" ? 413 : 422, { reason });
