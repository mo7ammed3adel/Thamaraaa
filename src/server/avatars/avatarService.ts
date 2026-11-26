import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { avatarVersion } from "./version";
import { sniffMimeType, looksExecutable } from "@/server/chat/fileSecurity";
import { deleteChatFile, newChatStorageKey, saveChatFile, statChatFile } from "@/server/chat/chatStorage";
import { allowAction } from "@/server/chat/rateLimit";
import { MAX_INPUT_PIXELS, runExclusive } from "@/server/storage/compression";
import { findMembership, memberIdsOf, notifyMembers, type ChatActor } from "@/server/chat/chatService";

/**
 * Profile photos and group/channel photos. Whatever is uploaded is decoded
 * and re-drawn as a fresh 256×256 WebP (~10–20 KB), so no original bytes, EXIF
 * or GPS data are ever kept or served — only pixels.
 */

export const MAX_AVATAR_UPLOAD_BYTES = 8 * 1024 * 1024;
const AVATAR_SIZE = 256;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export { avatarVersion };

type Processed = { ok: true; bytes: Uint8Array } | { ok: false; reason: "too_large" | "not_image" | "unreadable" };

export async function renderAvatar(input: Uint8Array): Promise<Processed> {
  if (input.length === 0 || input.length > MAX_AVATAR_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  const mime = sniffMimeType(input);
  if (!mime || !ACCEPTED.has(mime) || looksExecutable(input)) return { ok: false, reason: "not_image" };
  // Shares the one-image-at-a-time queue with chat uploads and screenshots.
  return runExclusive(async (): Promise<Processed> => {
    try {
      const out = await sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS, animated: false })
        .rotate()
        // "attention" crops toward the most interesting region (usually a face).
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: sharp.strategy.attention })
        .webp({ quality: 80 })
        .toBuffer();
      return { ok: true, bytes: new Uint8Array(out.buffer, out.byteOffset, out.length) };
    } catch {
      return { ok: false, reason: "unreadable" };
    }
  });
}

async function store(bytes: Uint8Array): Promise<string> {
  const key = newChatStorageKey();
  await saveChatFile(key, bytes);
  return key;
}

async function discard(key: string | null | undefined) {
  if (key) await deleteChatFile(key).catch((e) => console.error("Old avatar delete failed:", e));
}

/**
 * Sets a row's avatarKey and returns the key it replaced, in one statement, so
 * two uploads at once can't both "replace" the same old file and leak one.
 */
async function swapKey(table: "User" | "ChatConversation", id: string, key: string | null): Promise<{ found: boolean; previous: string | null }> {
  const rows =
    table === "User"
      ? await prisma.$queryRaw<{ previous: string | null }[]>`
          UPDATE "User" u SET "avatarKey" = ${key}
          FROM (SELECT id, "avatarKey" AS previous FROM "User" WHERE id = ${id} FOR UPDATE) old
          WHERE u.id = old.id RETURNING old.previous`
      : await prisma.$queryRaw<{ previous: string | null }[]>`
          UPDATE "ChatConversation" c SET "avatarKey" = ${key}
          FROM (SELECT id, "avatarKey" AS previous FROM "ChatConversation" WHERE id = ${id} FOR UPDATE) old
          WHERE c.id = old.id RETURNING old.previous`;
  return { found: rows.length > 0, previous: rows[0]?.previous ?? null };
}

/** Stores the new photo and swaps it in; never leaves a file nothing points to. */
async function replacePhoto(table: "User" | "ChatConversation", id: string, bytes: Uint8Array): Promise<string> {
  const key = await store(bytes);
  try {
    const { found, previous } = await swapKey(table, id, key);
    if (!found) throw new Error("Row is gone");
    await discard(previous);
    return key;
  } catch (error) {
    await discard(key);
    throw error;
  }
}

// ── Users ───────────────────────────────────────────────────────────────────

export async function setUserAvatar(actor: ChatActor, input: Uint8Array) {
  if (!allowAction(`avatar:${actor.id}`, 10, 60_000)) return { status: "rate_limited" as const };
  const rendered = await renderAvatar(input);
  if (!rendered.ok) return { status: "invalid" as const, error: rendered.reason };
  const key = await replacePhoto("User", actor.id, rendered.bytes);
  return { status: "ok" as const, version: avatarVersion(key) };
}

export async function removeUserAvatar(actor: ChatActor) {
  const { previous } = await swapKey("User", actor.id, null);
  await discard(previous);
  return { status: "ok" as const };
}

/** id → version for every active employee with a photo (a small map). */
export async function listUserAvatars(): Promise<Record<string, string>> {
  const rows = await prisma.user.findMany({ where: { avatarKey: { not: null }, status: "Active" }, select: { id: true, avatarKey: true } });
  return Object.fromEntries(rows.map((r) => [r.id, avatarVersion(r.avatarKey)!]));
}

export async function userAvatarFile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
  if (!user?.avatarKey) return null;
  return statChatFile(user.avatarKey).catch(() => null);
}

// ── Groups and channels ─────────────────────────────────────────────────────

async function manageable(actor: ChatActor, conversationId: string) {
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  // A DM shows the other person's photo; groups/channels are set by their admins.
  if (membership.conversation.type === "dm" || !["owner", "admin"].includes(membership.role)) return { status: "forbidden" as const };
  return { status: "ok" as const, membership };
}

export async function setConversationAvatar(actor: ChatActor, conversationId: string, input: Uint8Array) {
  const check = await manageable(actor, conversationId);
  if (check.status !== "ok") return check;
  if (!allowAction(`avatar:${actor.id}`, 10, 60_000)) return { status: "rate_limited" as const };
  const rendered = await renderAvatar(input);
  if (!rendered.ok) return { status: "invalid" as const, error: rendered.reason };
  const key = await replacePhoto("ChatConversation", conversationId, rendered.bytes);
  await notifyMembers(conversationId, await memberIdsOf(conversationId), "updated");
  return { status: "ok" as const, version: avatarVersion(key) };
}

export async function removeConversationAvatar(actor: ChatActor, conversationId: string) {
  const check = await manageable(actor, conversationId);
  if (check.status !== "ok") return check;
  const { previous } = await swapKey("ChatConversation", conversationId, null);
  await discard(previous);
  await notifyMembers(conversationId, await memberIdsOf(conversationId), "updated");
  return { status: "ok" as const };
}

/** Members only: a private group's photo is as private as its name. */
export async function conversationAvatarFile(actor: ChatActor, conversationId: string) {
  const membership = await findMembership(conversationId, actor.id);
  const key = membership?.conversation.avatarKey;
  if (!key) return null;
  return statChatFile(key).catch(() => null);
}
