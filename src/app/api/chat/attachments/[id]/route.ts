import { createReadStream } from "fs";
import { Readable, pipeline } from "stream";
import { createGunzip } from "zlib";
import { getAttachmentForView } from "@/server/chat/chatService";
import { chatThumbnail, statChatFile } from "@/server/chat/chatStorage";
import { isInlineMime } from "@/server/chat/fileSecurity";
import { requireChatActor } from "@/server/chat/routeHelpers";
import { errorJson } from "@/server/http/responses";

export const runtime = "nodejs";

/** Parses a single "bytes=start-end" range; multi-range requests get the whole file. */
function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, a, b] = match;
  let start: number;
  let end: number;
  if (a === "" && b === "") return "invalid";
  if (a === "") {
    start = Math.max(0, size - Number(b));
    end = size - 1;
  } else {
    start = Number(a);
    end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
  }
  if (start > end || start >= size) return "invalid";
  return { start, end };
}

/**
 * GET /api/chat/attachments/[id] — streams a file to a member of its
 * conversation, with Range support so video plays and seeks (iOS needs it).
 *
 * Only formats detected as image/video/audio/PDF are rendered inline;
 * everything else, including HTML and SVG, is a forced download with a generic
 * type, so an uploaded page can never run script on this origin.
 * Add ?download=1 to force a download for any type.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;

  const result = await getAttachmentForView(auth.actor, params.id);
  if (result.status !== "ok") return errorJson("Not found", 404);
  const { attachment } = result;

  // ?thumb=1 on a photo: the small square used by the media grid.
  if (new URL(request.url).searchParams.get("thumb") === "1" && attachment.category === "image") {
    try {
      const thumb = await chatThumbnail(attachment.storageKey);
      return new Response(Readable.toWeb(createReadStream(thumb.path)) as ReadableStream<Uint8Array>, {
        headers: {
          "Content-Type": "image/webp",
          "Content-Length": String(thumb.size),
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "Cross-Origin-Resource-Policy": "same-origin",
          "Cache-Control": "private, max-age=86400",
        },
      });
    } catch {
      /* fall through to the full image */
    }
  }

  let file: { path: string; size: number };
  try {
    file = await statChatFile(attachment.storageKey);
  } catch {
    return errorJson("File unavailable", 404);
  }

  const forceDownload = new URL(request.url).searchParams.get("download") === "1";
  const inline = !forceDownload && isInlineMime(attachment.mimeType);
  const encodedName = encodeURIComponent(attachment.originalName);
  const asciiName = attachment.originalName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");

  // Browsers' built-in PDF viewers refuse to render in a sandboxed document,
  // so PDFs drop the sandbox directive; they still get no script sources.
  const csp =
    inline && attachment.mimeType === "application/pdf"
      ? "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; object-src 'self'"
      : "default-src 'none'; img-src 'self'; media-src 'self'; sandbox";

  const headers: Record<string, string> = {
    "Content-Type": inline ? attachment.mimeType : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": csp,
    "Cross-Origin-Resource-Policy": "same-origin",
    "Accept-Ranges": "bytes",
    // Short-lived, so a deleted file or a removed member's access stops
    // working from the browser cache within a minute.
    "Cache-Control": "private, max-age=60",
  };

  // Stored gzipped (documents): decompress on the way out. These are never
  // media, so they are always sent whole rather than by range.
  if (attachment.storedEncoding === "gzip") {
    // pipeline() carries a read or corrupt-data error through to the response
    // (it aborts) instead of leaving it hanging.
    const unzipped = pipeline(createReadStream(file.path), createGunzip(), (error) => {
      if (error) console.error("Attachment decompress failed:", attachment.id, error.message);
    });
    return new Response(Readable.toWeb(unzipped) as ReadableStream<Uint8Array>, {
      status: 200,
      headers: { ...headers, "Accept-Ranges": "none", "Content-Length": String(attachment.size) },
    });
  }

  const range = parseRange(request.headers.get("range"), file.size);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${file.size}` } });
  }

  const { start, end } = range ?? { start: 0, end: file.size - 1 };
  const stream = Readable.toWeb(createReadStream(file.path, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(stream, {
    status: range ? 206 : 200,
    headers: {
      ...headers,
      "Content-Length": String(end - start + 1),
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${file.size}` } : {}),
    },
  });
}
