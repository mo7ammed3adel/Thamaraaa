import { prisma } from "@/lib/prisma";
import { LABEL_COLORS, MAX_LABEL_NAME } from "@/lib/chat/labels";
import { FOLDER_SECTIONS, MAX_FOLDERS_PER_SECTION, placeBefore, type FolderSection } from "@/lib/chat/folders";
import { findMembership, type ChatActor } from "./chatService";
import { allowAction } from "./rateLimit";

/**
 * Personal folders inside each sidebar section (channels, groups, direct
 * messages). You drag your conversations into them to sort the list your
 * own way; they belong to one employee and nobody else sees them.
 */

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_LABEL_NAME);
  return name || null;
}

function cleanColor(value: unknown): string | null {
  return typeof value === "string" && (LABEL_COLORS as readonly string[]).includes(value) ? value : null;
}

function cleanSection(value: unknown): FolderSection | null {
  return typeof value === "string" && (FOLDER_SECTIONS as readonly string[]).includes(value) ? (value as FolderSection) : null;
}

const limited = (actor: ChatActor) => !allowAction(`folders:${actor.id}`, 120, 60_000);

/** Your folders in display order, each with the conversations you're still in, in order. */
export async function listFolders(actor: ChatActor) {
  const folders = await prisma.chatFolder.findMany({
    where: { userId: actor.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        where: { conversation: { members: { some: { userId: actor.id } } } },
        orderBy: { position: "asc" },
        select: { conversationId: true },
      },
    },
  });
  return {
    status: "ok" as const,
    folders: folders.map((f) => ({ id: f.id, section: f.section, name: f.name, color: f.color, conversationIds: f.items.map((i) => i.conversationId) })),
  };
}

export async function createFolder(actor: ChatActor, input: { section?: unknown; name?: unknown; color?: unknown }) {
  if (limited(actor)) return { status: "rate_limited" as const };
  const section = cleanSection(input.section);
  const name = cleanName(input.name);
  if (!section) return { status: "invalid" as const, error: "Unknown section" };
  if (!name) return { status: "invalid" as const, error: "Folder name is required" };
  const color = cleanColor(input.color) ?? LABEL_COLORS[0];
  const count = await prisma.chatFolder.count({ where: { userId: actor.id, section } });
  if (count >= MAX_FOLDERS_PER_SECTION) return { status: "invalid" as const, error: "Too many folders here" };
  const folder = await prisma.chatFolder.create({ data: { userId: actor.id, section, name, color, position: count } });
  return { status: "ok" as const, folder: { id: folder.id, section, name, color, conversationIds: [] as string[] } };
}

export async function updateFolder(actor: ChatActor, folderId: string, input: { name?: unknown; color?: unknown }) {
  const data: { name?: string; color?: string } = {};
  if (input.name !== undefined) {
    const name = cleanName(input.name);
    if (!name) return { status: "invalid" as const, error: "Folder name is required" };
    data.name = name;
  }
  if (input.color !== undefined) {
    const color = cleanColor(input.color);
    if (!color) return { status: "invalid" as const, error: "Unknown color" };
    data.color = color;
  }
  const updated = await prisma.chatFolder.updateMany({ where: { id: folderId, userId: actor.id }, data });
  return updated.count ? { status: "ok" as const } : { status: "not_found" as const };
}

/** Deleting a folder puts its conversations back loose in the section. */
export async function deleteFolder(actor: ChatActor, folderId: string) {
  const deleted = await prisma.chatFolder.deleteMany({ where: { id: folderId, userId: actor.id } });
  return deleted.count ? { status: "ok" as const } : { status: "not_found" as const };
}

/**
 * Sets the order of your folders in one section. Ids you don't own are
 * ignored; your folders the list leaves out keep their order, after it.
 */
export async function reorderFolders(actor: ChatActor, input: { section?: unknown; ids?: unknown }) {
  if (limited(actor)) return { status: "rate_limited" as const };
  const section = cleanSection(input.section);
  if (!section || !Array.isArray(input.ids)) return { status: "invalid" as const, error: "Invalid order" };
  const current = (await prisma.chatFolder.findMany({ where: { userId: actor.id, section }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } })).map((f) => f.id);
  const mine = new Set(current);
  const wanted = Array.from(new Set(input.ids.filter((x): x is string => typeof x === "string" && mine.has(x))));
  const ids = [...wanted, ...current.filter((id) => !wanted.includes(id))];
  // updateMany: a folder deleted meanwhile is skipped instead of failing the lot.
  await prisma.$transaction(ids.map((id, position) => prisma.chatFolder.updateMany({ where: { id, userId: actor.id }, data: { position } })));
  return { status: "ok" as const };
}

/**
 * Moves a conversation you're in into one of your folders (just before
 * `beforeId`, or at the end), or back out of every folder when `folderId` is
 * null. The folder must sit in the section that matches the conversation's type.
 */
export async function moveToFolder(actor: ChatActor, conversationId: string, input: { folderId?: unknown; beforeId?: unknown }) {
  if (limited(actor)) return { status: "rate_limited" as const };
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  const key = { userId_conversationId: { userId: actor.id, conversationId } };

  if (input.folderId === null || input.folderId === undefined) {
    await prisma.chatFolderItem.deleteMany({ where: { userId: actor.id, conversationId } });
    return { status: "ok" as const };
  }
  if (typeof input.folderId !== "string") return { status: "invalid" as const, error: "Invalid folder" };
  const folder = await prisma.chatFolder.findFirst({
    where: { id: input.folderId, userId: actor.id },
    include: { items: { orderBy: { position: "asc" }, select: { conversationId: true } } },
  });
  if (!folder) return { status: "not_found" as const };
  if (folder.section !== membership.conversation.type) return { status: "invalid" as const, error: "This folder is for another section" };

  const beforeId = typeof input.beforeId === "string" ? input.beforeId : null;
  const order = placeBefore(folder.items.map((i) => i.conversationId), conversationId, beforeId);
  await prisma.$transaction([
    prisma.chatFolderItem.upsert({ where: key, create: { userId: actor.id, conversationId, folderId: folder.id }, update: { folderId: folder.id } }),
    // updateMany: an item removed meanwhile is skipped instead of failing the lot.
    ...order.map((id, position) => prisma.chatFolderItem.updateMany({ where: { userId: actor.id, conversationId: id, folderId: folder.id }, data: { position } })),
  ]);
  return { status: "ok" as const };
}
