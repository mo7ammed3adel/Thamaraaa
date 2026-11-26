import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

/**
 * On-disk storage for chat attachments, outside the public tree so nothing is
 * ever served as a static asset. Keys are generated here from random UUIDs —
 * the uploaded file name never reaches the file system.
 */
const STORAGE_ROOT = process.env.CHAT_STORAGE_DIR || path.join(process.cwd(), ".chat-files");

const KEY_PATTERN = /^\d{4}-\d{2}\/[0-9a-f-]{36}$/;

export function newChatStorageKey(now = new Date()): string {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${month}/${crypto.randomUUID()}`;
}

function resolveSafe(storageKey: string): string {
  if (!KEY_PATTERN.test(storageKey)) throw new Error("Unsafe storage key");
  const root = path.resolve(STORAGE_ROOT);
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) throw new Error("Storage key escapes the storage root");
  return target;
}

export async function saveChatFile(storageKey: string, data: Uint8Array): Promise<void> {
  const target = resolveSafe(storageKey);
  await fs.mkdir(path.dirname(target), { recursive: true });
  // "wx" refuses to overwrite: a key collision is a bug, never a replacement.
  await fs.writeFile(target, data, { flag: "wx" });
}

/** Resolves a key to its file and size, for streaming. Throws if it's missing. */
export async function statChatFile(storageKey: string): Promise<{ path: string; size: number }> {
  const target = resolveSafe(storageKey);
  const stat = await fs.stat(target);
  return { path: target, size: stat.size };
}

export async function deleteChatFile(storageKey: string): Promise<void> {
  await deleteChatThumbnail(storageKey).catch(() => undefined);
  try {
    await fs.unlink(resolveSafe(storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function sha256Hex(data: Uint8Array): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// ── Thumbnails (media grid) ─────────────────────────────────────────────────

const THUMB_EDGE = 320;

function thumbPath(storageKey: string): string {
  if (!KEY_PATTERN.test(storageKey)) throw new Error("Unsafe storage key");
  return path.join(path.resolve(STORAGE_ROOT), "thumbs", `${storageKey}.webp`);
}

/**
 * A small square WebP of a stored image, made on first request and kept on
 * disk, so the media grid never downloads full photos.
 */
export async function chatThumbnail(storageKey: string): Promise<{ path: string; size: number }> {
  const target = thumbPath(storageKey);
  try {
    const stat = await fs.stat(target);
    return { path: target, size: stat.size };
  } catch {
    /* not made yet */
  }
  const { default: sharp } = await import("sharp");
  const { runExclusive, MAX_INPUT_PIXELS } = await import("@/server/storage/compression");
  const source = resolveSafe(storageKey);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${crypto.randomUUID()}.part`;
  await runExclusive(() =>
    sharp(source, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
      .rotate()
      .resize(THUMB_EDGE, THUMB_EDGE, { fit: "cover" })
      .webp({ quality: 70 })
      .toFile(tmp)
  );
  await fs.rename(tmp, target);
  const stat = await fs.stat(target);
  return { path: target, size: stat.size };
}

export async function deleteChatThumbnail(storageKey: string): Promise<void> {
  try {
    await fs.unlink(thumbPath(storageKey));
  } catch {
    /* none */
  }
}
