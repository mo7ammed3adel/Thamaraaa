import { prisma } from "@/lib/prisma";
import { pusherConfigured, pusherServer } from "@/lib/pusher";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_FILES_PER_MESSAGE,
  MAX_GROUP_MEMBERS,
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MESSAGES_PAGE_SIZE,
  buildDmKey,
  canCreateChannel,
  findSticker,
  isAllowedReaction,
} from "@/lib/chat/constants";
import { inspectUploadedFile, type InspectedFile } from "./fileSecurity";
import { deleteChatFile, newChatStorageKey, saveChatFile, sha256Hex } from "./chatStorage";
import { allowAction } from "./rateLimit";

export type ChatActor = { id: string; name: string; role: string };

type MemberRole = "owner" | "admin" | "member";

const userSummary = { id: true, name: true, role: true, email: true, status: true } as const;

// ── Realtime ────────────────────────────────────────────────────────────────

/** Private per-user channel; the auth route only signs a user's own channel. */
export function chatChannelFor(userId: string): string {
  return `private-chat-${userId}`;
}

/**
 * Tells members something changed in a conversation. The payload carries only
 * ids — never message text — so even a leaked channel reveals nothing; clients
 * re-fetch through the authorized API.
 */
async function notifyMembers(conversationId: string, userIds: string[], kind: string): Promise<void> {
  if (!pusherConfigured || userIds.length === 0) return;
  const channels = Array.from(new Set(userIds)).map(chatChannelFor);
  try {
    for (let i = 0; i < channels.length; i += 100) {
      await pusherServer.trigger(channels.slice(i, i + 100), "chat", { conversationId, kind });
    }
  } catch (error) {
    console.error("Chat realtime trigger failed:", error);
  }
}

async function memberIdsOf(conversationId: string): Promise<string[]> {
  const rows = await prisma.chatMember.findMany({ where: { conversationId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\u0000/g, "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

async function findMembership(conversationId: string, userId: string) {
  return prisma.chatMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: { conversation: true },
  });
}

function isManager(role: string | undefined): boolean {
  return role === "owner" || role === "admin";
}

async function activeUsers(ids: string[]) {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === "string" && id)));
  if (unique.length === 0) return [];
  return prisma.user.findMany({ where: { id: { in: unique }, status: "Active" }, select: { id: true, name: true } });
}

async function postSystemMessage(conversationId: string, actorId: string, body: string) {
  await prisma.chatMessage.create({ data: { conversationId, senderId: actorId, kind: "system", body } });
  await prisma.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
}

// ── Message DTOs ────────────────────────────────────────────────────────────

const messageInclude = {
  sender: { select: { id: true, name: true, role: true } },
  attachments: { select: { id: true, originalName: true, mimeType: true, category: true, size: true } },
  reactions: { select: { emoji: true, userId: true, user: { select: { name: true } } } },
  replyTo: {
    select: { id: true, body: true, kind: true, deletedAt: true, sender: { select: { name: true } }, attachments: { select: { id: true } } },
  },
} as const;

type MessageRow = Awaited<ReturnType<typeof loadMessage>>;

function loadMessage(id: string) {
  return prisma.chatMessage.findUniqueOrThrow({ where: { id }, include: messageInclude });
}

function toMessageDto(row: NonNullable<MessageRow>, viewerId: string) {
  const deleted = Boolean(row.deletedAt);
  const grouped = new Map<string, { emoji: string; count: number; mine: boolean; names: string[] }>();
  for (const r of row.reactions) {
    const g = grouped.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, names: [] };
    g.count += 1;
    g.mine ||= r.userId === viewerId;
    g.names.push(r.user.name);
    grouped.set(r.emoji, g);
  }
  return {
    id: row.id,
    conversationId: row.conversationId,
    kind: row.kind,
    body: deleted ? null : row.body,
    stickerId: deleted ? null : row.stickerId,
    sender: row.sender,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deleted,
    attachments: deleted ? [] : row.attachments,
    reactions: deleted ? [] : Array.from(grouped.values()),
    replyTo: row.replyTo
      ? {
          id: row.replyTo.id,
          senderName: row.replyTo.sender?.name ?? null,
          body: row.replyTo.deletedAt ? null : row.replyTo.body,
          kind: row.replyTo.kind,
          deleted: Boolean(row.replyTo.deletedAt),
          hasAttachments: row.replyTo.attachments.length > 0,
        }
      : null,
  };
}

export type ChatMessageDto = ReturnType<typeof toMessageDto>;

// ── Conversations ───────────────────────────────────────────────────────────

/**
 * Unread counts for every conversation the user is in, in one query. A message
 * counts when it is newer than the member's lastReadAt, not deleted, not a
 * system notice, and not their own (messages from deleted accounts count too).
 */
async function unreadCounts(userId: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ conversationId: string; unread: number }[]>`
    SELECT m."conversationId", COUNT(msg.id)::int AS unread
    FROM "ChatMember" m
    JOIN "ChatMessage" msg
      ON msg."conversationId" = m."conversationId"
     AND msg."createdAt" > m."lastReadAt"
     AND msg."deletedAt" IS NULL
     AND msg.kind <> 'system'
     AND (msg."senderId" IS NULL OR msg."senderId" <> m."userId")
    WHERE m."userId" = ${userId}
    GROUP BY m."conversationId"`;
  return new Map(rows.map((r) => [r.conversationId, Number(r.unread)]));
}

export async function listConversations(actor: ChatActor) {
  const [memberships, unread] = await Promise.all([
    prisma.chatMember.findMany({
      where: { userId: actor.id },
      include: {
        conversation: {
          include: {
            _count: { select: { members: true } },
            // Only the other person matters (for DMs); never load every member.
            members: { where: { NOT: { userId: actor.id } }, take: 1, include: { user: { select: userSummary } } },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { sender: { select: { name: true } }, attachments: { select: { id: true } } },
            },
          },
        },
      },
    }),
    unreadCounts(actor.id),
  ]);

  const items = memberships.map((m) => {
      const c = m.conversation;
      const other = c.type === "dm" ? c.members[0]?.user ?? null : null;
      const last = c.messages[0];
      return {
        id: c.id,
        type: c.type,
        name: c.type === "dm" ? other?.name ?? "—" : c.name,
        isPrivate: c.isPrivate,
        memberCount: c._count.members,
        unread: unread.get(c.id) ?? 0,
        otherUser: other ? { id: other.id, name: other.name, role: other.role, active: other.status === "Active" } : null,
        lastMessageAt: c.lastMessageAt.toISOString(),
        lastMessage: last
          ? {
              senderName: last.sender?.name ?? null,
              mine: last.senderId === actor.id,
              kind: last.kind,
              body: last.deletedAt ? null : last.body,
              stickerId: last.deletedAt ? null : last.stickerId,
              deleted: Boolean(last.deletedAt),
              hasAttachments: last.attachments.length > 0,
            }
          : null,
      };
    });

  items.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  return items;
}

export async function getUnreadTotal(actor: ChatActor): Promise<number> {
  let total = 0;
  for (const n of Array.from((await unreadCounts(actor.id)).values())) total += n;
  return total;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/** Upload allowance per employee per rolling 24 hours. */
const DAILY_UPLOAD_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;

export async function getConversation(actor: ChatActor, conversationId: string) {
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  const c = membership.conversation;
  const members = await prisma.chatMember.findMany({
    where: { conversationId },
    include: { user: { select: userSummary } },
    orderBy: { joinedAt: "asc" },
  });
  const other = c.type === "dm" ? members.find((m) => m.userId !== actor.id)?.user : null;
  return {
    status: "ok" as const,
    conversation: {
      id: c.id,
      type: c.type,
      name: c.type === "dm" ? other?.name ?? "—" : c.name,
      description: c.description,
      isPrivate: c.isPrivate,
      createdAt: c.createdAt.toISOString(),
      myRole: membership.role as MemberRole,
      canCreateChannel: canCreateChannel(actor.role),
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.user.role,
        active: m.user.status === "Active",
        memberRole: m.role as MemberRole,
      })),
    },
  };
}

export async function createConversation(actor: ChatActor, input: Record<string, unknown>) {
  const type = input.type;
  const memberIds = Array.isArray(input.memberIds) ? (input.memberIds as unknown[]).filter((x): x is string => typeof x === "string") : [];

  if (type === "dm") {
    const otherId = memberIds.find((id) => id !== actor.id);
    if (!otherId) return { status: "invalid" as const, error: "Pick someone to message" };
    const [other] = await activeUsers([otherId]);
    if (!other) return { status: "invalid" as const, error: "That employee is not active" };

    const dmKey = buildDmKey(actor.id, other.id);
    const existing = await prisma.chatConversation.findUnique({ where: { dmKey } });
    if (existing) return { status: "ok" as const, id: existing.id };

    try {
      const created = await prisma.chatConversation.create({
        data: {
          type: "dm",
          dmKey,
          isPrivate: true,
          createdById: actor.id,
          members: { create: [{ userId: actor.id, role: "member" }, { userId: other.id, role: "member" }] },
        },
      });
      return { status: "ok" as const, id: created.id };
    } catch {
      // Two people opened the DM at the same moment; the unique key won.
      const again = await prisma.chatConversation.findUnique({ where: { dmKey } });
      if (again) return { status: "ok" as const, id: again.id };
      throw new Error("Could not open the conversation");
    }
  }

  if (type !== "group" && type !== "channel") return { status: "invalid" as const, error: "Unknown conversation type" };
  if (type === "channel" && !canCreateChannel(actor.role)) return { status: "forbidden" as const };
  if (!allowAction(`create:${actor.id}`, 10, 60 * 60_000)) return { status: "rate_limited" as const };

  const name = cleanText(input.name, MAX_NAME_LENGTH);
  if (!name) return { status: "invalid" as const, error: "A name is required" };
  const description = cleanText(input.description, MAX_DESCRIPTION_LENGTH);
  const isPrivate = type === "group" ? true : input.isPrivate === true;

  const others = (await activeUsers(memberIds)).filter((u) => u.id !== actor.id);
  if (type === "group" && others.length === 0) return { status: "invalid" as const, error: "Add at least one member" };
  if (others.length + 1 > MAX_GROUP_MEMBERS) return { status: "invalid" as const, error: "Too many members" };

  const created = await prisma.chatConversation.create({
    data: {
      type,
      name,
      description,
      isPrivate,
      createdById: actor.id,
      members: {
        create: [{ userId: actor.id, role: "owner" }, ...others.map((u) => ({ userId: u.id, role: "member" }))],
      },
    },
  });
  await postSystemMessage(created.id, actor.id, `created:${name}`);
  await notifyMembers(created.id, [actor.id, ...others.map((u) => u.id)], "created");
  return { status: "ok" as const, id: created.id };
}

export async function updateConversation(actor: ChatActor, conversationId: string, input: Record<string, unknown>) {
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  if (membership.conversation.type === "dm" || !isManager(membership.role)) return { status: "forbidden" as const };

  const data: { name?: string; description?: string | null } = {};
  if ("name" in input) {
    const name = cleanText(input.name, MAX_NAME_LENGTH);
    if (!name) return { status: "invalid" as const, error: "A name is required" };
    data.name = name;
  }
  if ("description" in input) data.description = cleanText(input.description, MAX_DESCRIPTION_LENGTH);

  await prisma.chatConversation.update({ where: { id: conversationId }, data });
  if (data.name && data.name !== membership.conversation.name) await postSystemMessage(conversationId, actor.id, `renamed:${data.name}`);
  await notifyMembers(conversationId, await memberIdsOf(conversationId), "updated");
  return { status: "ok" as const };
}

export async function addMembers(actor: ChatActor, conversationId: string, userIds: unknown) {
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  const c = membership.conversation;
  if (c.type === "dm") return { status: "forbidden" as const };
  // In a group anyone inside may bring a colleague in; a channel is curated.
  if (c.type === "channel" && !isManager(membership.role)) return { status: "forbidden" as const };
  if (!allowAction(`add:${actor.id}`, 30, 60 * 60_000)) return { status: "rate_limited" as const };

  const ids =Array.isArray(userIds) ? (userIds as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const existing = new Set(await memberIdsOf(conversationId));
  const toAdd = (await activeUsers(ids)).filter((u) => !existing.has(u.id));
  if (toAdd.length === 0) return { status: "ok" as const, added: 0 };
  if (existing.size + toAdd.length > MAX_GROUP_MEMBERS) return { status: "invalid" as const, error: "Too many members" };

  await prisma.chatMember.createMany({
    data: toAdd.map((u) => ({ conversationId, userId: u.id, role: "member" })),
    skipDuplicates: true,
  });
  await postSystemMessage(conversationId, actor.id, `added:${toAdd.map((u) => u.name).join("، ")}`);
  await notifyMembers(conversationId, [...Array.from(existing), ...toAdd.map((u) => u.id)], "members");
  return { status: "ok" as const, added: toAdd.length };
}

export async function removeMember(actor: ChatActor, conversationId: string, userId: string) {
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  const c = membership.conversation;
  if (c.type === "dm") return { status: "forbidden" as const };

  const target = await prisma.chatMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: { user: { select: { name: true } } },
  });
  if (!target) return { status: "not_found" as const };

  const leaving = userId === actor.id;
  if (!leaving) {
    if (!isManager(membership.role)) return { status: "forbidden" as const };
    if (target.role === "owner") return { status: "forbidden" as const };
    if (target.role === "admin" && membership.role !== "owner") return { status: "forbidden" as const };
  }

  const before = await memberIdsOf(conversationId);
  // An owner who walks away hands the space to the longest-serving admin, or
  // failing that the longest-serving member, so it is never left unmanaged.
  // One serializable transaction, so a simultaneous departure can't leave it ownerless.
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.chatMember.delete({ where: { id: target.id } });
        if (leaving && target.role === "owner") {
          const heir =
            (await tx.chatMember.findFirst({ where: { conversationId, role: "admin" }, orderBy: { joinedAt: "asc" } })) ??
            (await tx.chatMember.findFirst({ where: { conversationId }, orderBy: { joinedAt: "asc" } }));
          if (heir) await tx.chatMember.update({ where: { id: heir.id }, data: { role: "owner" } });
        }
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") return { status: "not_found" as const };
    if ((error as { code?: string }).code === "P2034") return { status: "rate_limited" as const };
    throw error;
  }

  await postSystemMessage(conversationId, actor.id, leaving ? `left:${target.user.name}` : `removed:${target.user.name}`);
  await notifyMembers(conversationId, before, "members");
  return { status: "ok" as const };
}

export async function setMemberRole(actor: ChatActor, conversationId: string, userId: string, role: unknown) {
  if (role !== "admin" && role !== "member") return { status: "invalid" as const, error: "Unknown role" };
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  if (membership.conversation.type === "dm" || membership.role !== "owner") return { status: "forbidden" as const };
  const target = await prisma.chatMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  if (!target || target.role === "owner") return { status: "forbidden" as const };
  await prisma.chatMember.update({ where: { id: target.id }, data: { role } });
  await notifyMembers(conversationId, await memberIdsOf(conversationId), "members");
  return { status: "ok" as const };
}

export async function browseChannels(actor: ChatActor) {
  const channels = await prisma.chatConversation.findMany({
    where: { type: "channel", isPrivate: false },
    include: { _count: { select: { members: true } }, members: { where: { userId: actor.id }, select: { id: true } } },
    orderBy: { name: "asc" },
  });
  return channels.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    memberCount: c._count.members,
    joined: c.members.length > 0,
  }));
}

export async function joinChannel(actor: ChatActor, conversationId: string) {
  const c = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
  if (!c || c.type !== "channel") return { status: "not_found" as const };
  if (c.isPrivate) return { status: "forbidden" as const };
  const existing = await findMembership(conversationId, actor.id);
  if (existing) return { status: "ok" as const };
  if (!allowAction(`join:${actor.id}`, 30, 60 * 60_000)) return { status: "rate_limited" as const };
  try {
    await prisma.chatMember.create({ data: { conversationId, userId: actor.id, role: "member" } });
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "ok" as const }; // double click
    throw error;
  }
  await postSystemMessage(conversationId, actor.id, `joined:${actor.name}`);
  await notifyMembers(conversationId, await memberIdsOf(conversationId), "members");
  return { status: "ok" as const };
}

export async function searchUsers(actor: ChatActor, query: unknown) {
  const q = typeof query === "string" ? query.trim().slice(0, 80) : "";
  const users = await prisma.user.findMany({
    where: {
      status: "Active",
      id: { not: actor.id },
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
    take: q ? 20 : 50,
  });
  return users;
}

// ── Messages ────────────────────────────────────────────────────────────────

/**
 * A page of messages, oldest first. `before` is a message id: the cursor is
 * (createdAt, id), so messages sharing a millisecond are never skipped.
 */
export async function listMessages(actor: ChatActor, conversationId: string, params: { before?: string | null }) {
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };

  let cursorWhere = {};
  if (params.before) {
    const anchor = await prisma.chatMessage.findUnique({ where: { id: params.before }, select: { conversationId: true, createdAt: true } });
    if (!anchor || anchor.conversationId !== conversationId) return { status: "invalid" as const, error: "Bad cursor" };
    cursorWhere = {
      OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: params.before } }],
    };
  }

  const rows = await prisma.chatMessage.findMany({
    where: { conversationId, ...cursorWhere },
    include: messageInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MESSAGES_PAGE_SIZE + 1,
  });

  const hasMore = rows.length > MESSAGES_PAGE_SIZE;
  const page = rows.slice(0, MESSAGES_PAGE_SIZE);
  page.reverse();

  // Read receipts for the viewer only: the latest time each other member read.
  const members = await prisma.chatMember.findMany({ where: { conversationId }, select: { userId: true, lastReadAt: true } });
  const othersReadAt = members.filter((m) => m.userId !== actor.id).map((m) => m.lastReadAt.toISOString());

  return {
    status: "ok" as const,
    messages: page.map((r) => toMessageDto(r, actor.id)),
    hasMore,
    othersReadAt,
  };
}

export type UploadedFile = { name: string; bytes: Uint8Array };

export async function sendMessage(
  actor: ChatActor,
  conversationId: string,
  input: { body?: unknown; stickerId?: unknown; replyToId?: unknown; files?: UploadedFile[] }
) {
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };

  // A DM with someone who has since been deactivated becomes read-only.
  if (membership.conversation.type === "dm") {
    const others = await prisma.chatMember.findMany({
      where: { conversationId, NOT: { userId: actor.id } },
      include: { user: { select: { status: true } } },
    });
    if (others.some((o) => o.user.status !== "Active")) return { status: "forbidden" as const };
  }

  if (!allowAction(`msg:${actor.id}`, 20, 10_000)) return { status: "rate_limited" as const };

  const files = input.files ?? [];
  if (files.length > MAX_FILES_PER_MESSAGE) return { status: "invalid" as const, error: `At most ${MAX_FILES_PER_MESSAGE} files per message` };
  if (files.length > 0 && !allowAction(`upload:${actor.id}`, 40, 60_000)) return { status: "rate_limited" as const };

  const body = typeof input.body === "string" ? input.body.replace(/\u0000/g, "").trim() : "";
  if (body.length > MAX_MESSAGE_LENGTH) return { status: "invalid" as const, error: "Message is too long" };

  const sticker = input.stickerId != null ? findSticker(input.stickerId) : undefined;
  if (input.stickerId != null && !sticker) return { status: "invalid" as const, error: "Unknown sticker" };
  if (!body && !sticker && files.length === 0) return { status: "invalid" as const, error: "Message is empty" };

  let replyToId: string | null = null;
  if (typeof input.replyToId === "string" && input.replyToId) {
    const parent = await prisma.chatMessage.findUnique({ where: { id: input.replyToId }, select: { conversationId: true } });
    if (!parent || parent.conversationId !== conversationId) return { status: "invalid" as const, error: "Reply target not found" };
    replyToId = input.replyToId;
  }

  // Inspect every file before writing any, so one bad file rejects the whole
  // message and nothing half-uploaded is left behind.
  const inspected: { file: UploadedFile; result: Extract<InspectedFile, { ok: true }> }[] = [];
  for (const file of files) {
    const result = inspectUploadedFile({ name: file.name, bytes: file.bytes });
    if (!result.ok) return { status: "rejected_file" as const, fileName: file.name, reason: result.reason };
    inspected.push({ file, result });
  }

  if (inspected.length > 0) {
    const incoming = inspected.reduce((n, i) => n + i.file.bytes.length, 0);
    const recent = await prisma.chatAttachment.aggregate({
      where: { uploaderId: actor.id, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _sum: { size: true },
    });
    if ((recent._sum.size ?? 0) + incoming > DAILY_UPLOAD_QUOTA_BYTES) return { status: "rate_limited" as const };
  }

  const stored: { key: string; file: UploadedFile; result: Extract<InspectedFile, { ok: true }> }[] = [];
  let messageId: string;
  try {
    for (const item of inspected) {
      const key = newChatStorageKey();
      await saveChatFile(key, item.file.bytes);
      stored.push({ key, ...item });
    }

    const now = new Date();
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId,
          senderId: actor.id,
          kind: sticker ? "sticker" : "text",
          body: sticker ? null : body || null,
          stickerId: sticker?.id ?? null,
          replyToId,
          createdAt: now,
          attachments: {
            create: stored.map((s) => ({
              conversationId,
              uploaderId: actor.id,
              storageKey: s.key,
              originalName: s.result.safeName,
              mimeType: s.result.mimeType,
              category: s.result.category,
              size: s.file.bytes.length,
              sha256: sha256Hex(s.file.bytes),
            })),
          },
        },
      });
      await tx.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
      await tx.chatMember.update({ where: { id: membership.id }, data: { lastReadAt: now } });
      return created;
    });
    messageId = message.id;
  } catch (error) {
    // Only reached when nothing was committed, so the files are truly orphans.
    await Promise.all(stored.map((s) => deleteChatFile(s.key).catch(() => undefined)));
    throw error;
  }

  await notifyMembers(conversationId, await memberIdsOf(conversationId), "message");
  return { status: "ok" as const, message: toMessageDto(await loadMessage(messageId), actor.id) };
}

async function messageWithMembership(actor: ChatActor, messageId: string) {
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) return null;
  const membership = await findMembership(message.conversationId, actor.id);
  if (!membership) return null;
  return { message, membership };
}

export async function editMessage(actor: ChatActor, messageId: string, body: unknown) {
  const found = await messageWithMembership(actor, messageId);
  if (!found) return { status: "not_found" as const };
  const { message } = found;
  if (message.senderId !== actor.id || message.kind !== "text" || message.deletedAt) return { status: "forbidden" as const };

  const text = typeof body === "string" ? body.replace(/\u0000/g, "").trim() : "";
  if (!text) return { status: "invalid" as const, error: "Message is empty" };
  if (text.length > MAX_MESSAGE_LENGTH) return { status: "invalid" as const, error: "Message is too long" };

  await prisma.chatMessage.update({ where: { id: messageId }, data: { body: text, editedAt: new Date() } });
  await notifyMembers(message.conversationId, await memberIdsOf(message.conversationId), "edited");
  return { status: "ok" as const, message: toMessageDto(await loadMessage(messageId), actor.id) };
}

export async function deleteMessage(actor: ChatActor, messageId: string) {
  const found = await messageWithMembership(actor, messageId);
  if (!found) return { status: "not_found" as const };
  const { message, membership } = found;
  if (message.deletedAt) return { status: "ok" as const };
  const own = message.senderId === actor.id;
  const moderator = membership.conversation.type !== "dm" && isManager(membership.role);
  if (!own && !moderator) return { status: "forbidden" as const };
  if (message.kind === "system") return { status: "forbidden" as const };

  // Deleting a message really removes its files — a "deleted" photo must not
  // stay downloadable from a saved link.
  const attachments = await prisma.chatAttachment.findMany({ where: { messageId }, select: { id: true, storageKey: true } });
  await prisma.$transaction([
    prisma.chatAttachment.deleteMany({ where: { messageId } }),
    prisma.chatReaction.deleteMany({ where: { messageId } }),
    prisma.chatMessage.update({ where: { id: messageId }, data: { deletedAt: new Date(), body: null, stickerId: null } }),
  ]);
  await Promise.all(attachments.map((a) => deleteChatFile(a.storageKey).catch((e) => console.error("Chat file delete failed:", e))));

  await notifyMembers(message.conversationId, await memberIdsOf(message.conversationId), "deleted");
  return { status: "ok" as const };
}

export async function toggleReaction(actor: ChatActor, messageId: string, emoji: unknown) {
  if (!isAllowedReaction(emoji)) return { status: "invalid" as const, error: "Unsupported reaction" };
  const found = await messageWithMembership(actor, messageId);
  if (!found || found.message.deletedAt || found.message.kind === "system") return { status: "not_found" as const };
  if (!allowAction(`react:${actor.id}`, 60, 60_000)) return { status: "rate_limited" as const };

  const where = { messageId_userId_emoji: { messageId, userId: actor.id, emoji } };
  const existing = await prisma.chatReaction.findUnique({ where });
  try {
    if (existing) await prisma.chatReaction.deleteMany({ where: { messageId, userId: actor.id, emoji } });
    else await prisma.chatReaction.create({ data: { messageId, userId: actor.id, emoji } });
  } catch (error) {
    // A double click raced us to the same reaction; the end state is the same.
    if (!isUniqueViolation(error)) throw error;
  }

  await notifyMembers(found.message.conversationId, await memberIdsOf(found.message.conversationId), "reaction");
  return { status: "ok" as const, message: toMessageDto(await loadMessage(messageId), actor.id) };
}

export async function markRead(actor: ChatActor, conversationId: string) {
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  await prisma.chatMember.update({ where: { id: membership.id }, data: { lastReadAt: new Date() } });
  return { status: "ok" as const };
}

export async function getAttachmentForView(actor: ChatActor, attachmentId: string) {
  const attachment = await prisma.chatAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || !attachment.messageId) return { status: "not_found" as const };
  const membership = await findMembership(attachment.conversationId, actor.id);
  // Not-found rather than forbidden, so ids can't be probed for existence.
  if (!membership) return { status: "not_found" as const };
  return { status: "ok" as const, attachment };
}
