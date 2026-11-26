import { Prisma } from "@prisma/client";
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
import { compressForStorage, optimizeImage } from "@/server/storage/compression";
import { avatarVersion } from "@/server/avatars/version";
import { notifyUsers } from "@/lib/notify";
import { cleanDurationMs, cleanWaveform, isMissedCall, isRecordedAudioMime, type MediaMessageKind } from "@/lib/chat/media";

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
export async function notifyMembers(conversationId: string, userIds: string[], kind: string): Promise<void> {
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

export async function memberIdsOf(conversationId: string): Promise<string[]> {
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

export async function findMembership(conversationId: string, userId: string) {
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

export async function postSystemMessage(conversationId: string, actorId: string, body: string) {
  await prisma.chatMessage.create({ data: { conversationId, senderId: actorId, kind: "system", body } });
  await prisma.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
}

// ── Message DTOs ────────────────────────────────────────────────────────────

const messageInclude = {
  sender: { select: { id: true, name: true, role: true } },
  attachments: { select: { id: true, originalName: true, mimeType: true, category: true, size: true, durationMs: true, waveform: true } },
  call: { select: { id: true, video: true, startedAt: true, endedAt: true, participantIds: true, conversation: { select: { type: true } } } },
  reactions: { select: { emoji: true, userId: true, user: { select: { name: true } } } },
} as const;

type MessageRow = Awaited<ReturnType<typeof loadMessage>>;
type ThreadSummary = { count: number; lastReplyAt: string; participants: { id: string; name: string }[] };

function loadMessage(id: string) {
  return prisma.chatMessage.findUniqueOrThrow({ where: { id }, include: messageInclude });
}

/**
 * Thread summaries for a page of root messages, in two bounded queries
 * (counts, then up to 3 recent repliers each) — replies are never loaded.
 */
async function threadSummaries(rows: { id: string; replyToId: string | null }[]): Promise<Map<string, ThreadSummary>> {
  const map = new Map<string, ThreadSummary>();
  const rootIds = rows.filter((r) => !r.replyToId).map((r) => r.id);
  if (rootIds.length === 0) return map;

  const groups = await prisma.chatMessage.groupBy({
    by: ["replyToId"],
    where: { replyToId: { in: rootIds }, deletedAt: null },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  for (const g of groups) {
    if (g.replyToId && g._max.createdAt) map.set(g.replyToId, { count: g._count._all, lastReplyAt: g._max.createdAt.toISOString(), participants: [] });
  }
  if (map.size === 0) return map;

  // Each replier's latest reply per thread, newest first.
  const repliers = await prisma.$queryRaw<{ replyToId: string; senderId: string; name: string }[]>`
    SELECT x."replyToId", x."senderId", u.name
    FROM (
      SELECT DISTINCT ON (m."replyToId", m."senderId") m."replyToId", m."senderId", m."createdAt"
      FROM "ChatMessage" m
      WHERE m."replyToId" IN (${Prisma.join(Array.from(map.keys()))})
        AND m."deletedAt" IS NULL AND m."senderId" IS NOT NULL
      ORDER BY m."replyToId", m."senderId", m."createdAt" DESC
    ) x
    JOIN "User" u ON u.id = x."senderId"
    ORDER BY x."createdAt" DESC`;
  for (const r of repliers) {
    const summary = map.get(r.replyToId);
    if (summary && summary.participants.length < 3) summary.participants.push({ id: r.senderId, name: r.name });
  }
  return map;
}

async function toDtos(rows: NonNullable<MessageRow>[], viewerId: string) {
  const threads = await threadSummaries(rows);
  return rows.map((r) => toMessageDto(r, viewerId, threads.get(r.id) ?? null));
}

async function loadDto(id: string, viewerId: string) {
  return (await toDtos([await loadMessage(id)], viewerId))[0];
}

function toMessageDto(row: NonNullable<MessageRow>, viewerId: string, thread: ThreadSummary | null = null) {
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
    threadRootId: row.replyToId,
    // Kept even on a deleted root, so its thread stays reachable (Slack).
    thread,
    pinned: !deleted && Boolean(row.pinnedAt),
    call: row.call
      ? {
          id: row.call.id,
          video: row.call.video,
          startedAt: row.call.startedAt.toISOString(),
          endedAt: row.call.endedAt?.toISOString() ?? null,
          participantCount: new Set(row.call.participantIds).size,
          missed: isMissedCall(row.call, row.call.conversation.type),
        }
      : null,
  };
}

// ── Mentions ────────────────────────────────────────────────────────────────

/** Mentions are stored in the body as <@userId>, like Slack. */
const MENTION_TOKEN = /<@([0-9a-f-]{36})>/g;

export function mentionedIds(body: string | null | undefined): string[] {
  if (!body) return [];
  return Array.from(new Set(Array.from(body.matchAll(MENTION_TOKEN), (m) => m[1])));
}

/** Replaces <@id> tokens with @Name, for previews and notification text. */
async function plainText(body: string, names?: Map<string, string>): Promise<string> {
  const ids = mentionedIds(body);
  if (ids.length === 0) return body;
  const map =
    names ?? new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return body.replace(MENTION_TOKEN, (_m, id: string) => `@${map.get(id) ?? "—"}`);
}

function chatLink(conversationId: string, threadId?: string | null) {
  return `/dashboard/chat?c=${conversationId}${threadId ? `&t=${threadId}` : ""}`;
}

// ── Presence ────────────────────────────────────────────────────────────────

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const presenceWrites = new Map<string, number>();

/** Records that the user has the chat open; written at most once a minute. */
async function touchPresence(userId: string) {
  const now = Date.now();
  if (now - (presenceWrites.get(userId) ?? 0) < 60_000) return;
  presenceWrites.set(userId, now);
  await prisma.chatPresence
    .upsert({ where: { userId }, update: { lastSeenAt: new Date(now) }, create: { userId, lastSeenAt: new Date(now) } })
    .catch(() => undefined);
}

async function onlineSet(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await prisma.chatPresence.findMany({
    where: { userId: { in: userIds }, lastSeenAt: { gt: new Date(Date.now() - ONLINE_WINDOW_MS) } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
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
     AND msg."replyToId" IS NULL
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
              where: { replyToId: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { sender: { select: { name: true } }, attachments: { select: { id: true } } },
            },
          },
        },
      },
    }),
    unreadCounts(actor.id),
    touchPresence(actor.id),
  ]);

  const dmOthers = memberships.flatMap((m) => (m.conversation.type === "dm" && m.conversation.members[0] ? [m.conversation.members[0].userId] : []));
  const online = await onlineSet(dmOthers);

  // Resolve @mentions in the previews with one name lookup for the whole list.
  const previewIds = Array.from(new Set(memberships.flatMap((m) => mentionedIds(m.conversation.messages[0]?.body))));
  const names = new Map(
    previewIds.length
      ? (await prisma.user.findMany({ where: { id: { in: previewIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name])
      : []
  );

  const items = await Promise.all(memberships.map(async (m) => {
      const c = m.conversation;
      const other = c.type === "dm" ? c.members[0]?.user ?? null : null;
      const last = c.messages[0];
      return {
        lastReadAt: m.lastReadAt.toISOString(),
        online: other ? online.has(other.id) : false,
        id: c.id,
        type: c.type,
        name: c.type === "dm" ? other?.name ?? "—" : c.name,
        isPrivate: c.isPrivate,
        avatarV: c.type === "dm" ? null : avatarVersion(c.avatarKey),
        memberCount: c._count.members,
        unread: unread.get(c.id) ?? 0,
        otherUser: other ? { id: other.id, name: other.name, role: other.role, active: other.status === "Active" } : null,
        lastMessageAt: c.lastMessageAt.toISOString(),
        lastMessage: last
          ? {
              senderName: last.sender?.name ?? null,
              mine: last.senderId === actor.id,
              kind: last.kind,
              body: last.deletedAt || !last.body ? null : await plainText(last.body, names),
              stickerId: last.deletedAt ? null : last.stickerId,
              deleted: Boolean(last.deletedAt),
              hasAttachments: last.attachments.length > 0,
            }
          : null,
      };
    }));

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
  const online = await onlineSet(members.map((m) => m.userId));
  const pinnedCount = await prisma.chatMessage.count({ where: { conversationId, pinnedAt: { not: null }, deletedAt: null } });
  return {
    status: "ok" as const,
    conversation: {
      pinnedCount,
      id: c.id,
      type: c.type,
      name: c.type === "dm" ? other?.name ?? "—" : c.name,
      description: c.description,
      isPrivate: c.isPrivate,
      avatarV: c.type === "dm" ? null : avatarVersion(c.avatarKey),
      isClientGroup: Boolean(c.projectId),
      createdAt: c.createdAt.toISOString(),
      myRole: membership.role as MemberRole,
      canCreateChannel: canCreateChannel(actor.role),
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.user.role,
        active: m.user.status === "Active",
        online: online.has(m.userId),
        memberRole: m.role as MemberRole,
        // Client groups: membership that follows the project assignment.
        managed: Boolean(c.projectId) && m.autoAdded,
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
  // In a group anyone inside may bring a colleague in; a channel is curated,
  // and so is a client group (it holds that client's history).
  if ((c.type === "channel" || c.projectId) && !isManager(membership.role)) return { status: "forbidden" as const };
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
  // In a client group, people assigned to the project are there because of
  // the assignment: they leave when they are unassigned, not by hand.
  if (c.projectId && target.autoAdded) return { status: "invalid" as const, error: "managed_by_project" };

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
    // Thread replies live in their thread, not in the channel (Slack).
    where: { conversationId, replyToId: null, ...cursorWhere },
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
    messages: await toDtos(page, actor.id),
    hasMore,
    othersReadAt,
    // Where the "new messages" line goes, as of before this visit marks it read.
    myLastReadAt: membership.lastReadAt.toISOString(),
  };
}

/** A thread: its root message followed by every reply, oldest first. */
export async function listThread(actor: ChatActor, rootId: string) {
  const root = await prisma.chatMessage.findUnique({ where: { id: rootId }, include: messageInclude });
  if (!root || root.replyToId) return { status: "not_found" as const };
  const membership = await findMembership(root.conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  if (!allowAction(`thread:${actor.id}`, 120, 60_000)) return { status: "rate_limited" as const };
  const replies = await prisma.chatMessage.findMany({
    where: { replyToId: rootId },
    include: messageInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 500,
  });
  return { status: "ok" as const, root: toMessageDto(root, actor.id), replies: replies.map((r) => toMessageDto(r, actor.id)) };
}

export async function togglePin(actor: ChatActor, messageId: string) {
  const found = await messageWithMembership(actor, messageId);
  if (!found || found.message.deletedAt || found.message.kind === "system") return { status: "not_found" as const };
  if (!allowAction(`pin:${actor.id}`, 20, 60_000)) return { status: "rate_limited" as const };
  const pinned = Boolean(found.message.pinnedAt);
  await prisma.chatMessage.update({
    where: { id: messageId },
    data: pinned ? { pinnedAt: null, pinnedById: null } : { pinnedAt: new Date(), pinnedById: actor.id },
  });
  await notifyMembers(found.message.conversationId, await memberIdsOf(found.message.conversationId), "pin");
  return { status: "ok" as const, message: await loadDto(messageId, actor.id) };
}

export async function listPinned(actor: ChatActor, conversationId: string) {
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  if (!allowAction(`pins:${actor.id}`, 60, 60_000)) return { status: "rate_limited" as const };
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId, pinnedAt: { not: null }, deletedAt: null },
    include: messageInclude,
    orderBy: { pinnedAt: "desc" },
    take: 100,
  });
  return { status: "ok" as const, messages: await toDtos(rows, actor.id) };
}

/** Searches message text in every conversation the caller belongs to. */
export async function searchMessages(actor: ChatActor, query: unknown) {
  const q = typeof query === "string" ? query.trim().slice(0, 100) : "";
  if (q.length < 2) return { status: "ok" as const, hits: [] };
  if (!allowAction(`search:${actor.id}`, 30, 60_000)) return { status: "rate_limited" as const };
  // LIKE wildcards are matched literally: searching "__" must not match everything.
  const literal = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await prisma.chatMessage.findMany({
    where: {
      deletedAt: null,
      kind: "text",
      body: { contains: literal, mode: "insensitive" },
      conversation: { members: { some: { userId: actor.id } } },
    },
    include: {
      sender: { select: { id: true, name: true } },
      conversation: {
        select: { id: true, type: true, name: true, members: { where: { NOT: { userId: actor.id } }, take: 1, select: { user: { select: { name: true } } } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  // One name lookup for every @mention across all hits.
  const ids = Array.from(new Set(rows.flatMap((r) => mentionedIds(r.body))));
  const names = new Map(
    ids.length ? (await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]) : []
  );
  const hits = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      conversationId: r.conversationId,
      threadRootId: r.replyToId,
      conversationName: r.conversation.type === "dm" ? r.conversation.members[0]?.user.name ?? "—" : r.conversation.name,
      conversationType: r.conversation.type,
      sender: r.sender,
      body: await plainText(r.body ?? "", names),
      createdAt: r.createdAt.toISOString(),
    }))
  );
  return { status: "ok" as const, hits };
}

export type UploadedFile = { name: string; bytes: Uint8Array };

export async function sendMessage(
  actor: ChatActor,
  conversationId: string,
  input: {
    body?: unknown;
    stickerId?: unknown;
    replyToId?: unknown;
    files?: UploadedFile[];
    /** A voice note or call recording: exactly one recorded-audio file, no text. */
    media?: { kind: MediaMessageKind; durationMs?: unknown; waveform?: unknown };
  }
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
  const media = input.media;
  if (media && (files.length !== 1 || body || sticker)) return { status: "invalid" as const, error: "A voice message is one recording" };

  // A reply always attaches to the thread's root, so threads stay one level deep.
  let replyToId: string | null = null;
  if (typeof input.replyToId === "string" && input.replyToId) {
    const parent = await prisma.chatMessage.findUnique({ where: { id: input.replyToId }, select: { conversationId: true, replyToId: true, kind: true, deletedAt: true } });
    if (!parent || parent.conversationId !== conversationId) return { status: "invalid" as const, error: "Reply target not found" };
    if (parent.kind === "system") return { status: "invalid" as const, error: "Can't reply to that" };
    replyToId = parent.replyToId ?? input.replyToId;
    // A deleted message can keep its existing thread going, but not start one.
    if (!parent.replyToId && parent.deletedAt && !(await prisma.chatMessage.count({ where: { replyToId } }))) {
      return { status: "invalid" as const, error: "Reply target not found" };
    }
  }

  // Inspect every file before writing any, so one bad file rejects the whole
  // message and nothing half-uploaded is left behind.
  const inspected: { file: UploadedFile; result: Extract<InspectedFile, { ok: true }> }[] = [];
  for (const file of files) {
    const result = inspectUploadedFile({ name: file.name, bytes: file.bytes });
    if (!result.ok) return { status: "rejected_file" as const, fileName: file.name, reason: result.reason };
    inspected.push({ file, result });
  }
  // The bytes, not the browser, decide it's audio we can play back.
  if (media && !isRecordedAudioMime(inspected[0].result.mimeType)) {
    return { status: "rejected_file" as const, fileName: files[0].name, reason: "type_mismatch" };
  }
  const durationMs = media ? cleanDurationMs(media.durationMs, media.kind) : null;
  const waveform = media ? cleanWaveform(media.waveform) : null;

  if (inspected.length > 0) {
    const incoming = inspected.reduce((n, i) => n + i.file.bytes.length, 0);
    const recent = await prisma.chatAttachment.aggregate({
      where: { uploaderId: actor.id, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _sum: { size: true },
    });
    if ((recent._sum.size ?? 0) + incoming > DAILY_UPLOAD_QUOTA_BYTES) return { status: "rate_limited" as const };
  }

  type Stored = { key: string; file: UploadedFile; result: Extract<InspectedFile, { ok: true }>; served: Uint8Array; disk: Uint8Array; encoding: "identity" | "gzip" };
  const stored: Stored[] = [];
  let messageId: string;
  try {
    for (const item of inspected) {
      // Smaller on disk: photos resized/re-encoded (and stripped of EXIF),
      // uncompressed documents gzipped. "served" is what downloads return.
      const served = item.result.category === "image" ? (await optimizeImage(item.file.bytes, item.result.mimeType)).bytes : item.file.bytes;
      const { bytes: disk, encoding } = await compressForStorage(served, item.result.mimeType);
      const key = newChatStorageKey();
      await saveChatFile(key, disk);
      stored.push({ key, ...item, served, disk, encoding });
    }

    const now = new Date();
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId,
          senderId: actor.id,
          kind: media ? media.kind : sticker ? "sticker" : "text",
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
              size: s.served.length,
              sha256: sha256Hex(s.served),
              storedEncoding: s.encoding,
              storedSize: s.disk.length,
              durationMs,
              waveform,
            })),
          },
        },
      });
      // A thread reply doesn't move the conversation up the list (Slack).
      if (!replyToId) {
        await tx.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
        await tx.chatMember.update({ where: { id: membership.id }, data: { lastReadAt: now } });
      }
      return created;
    });
    messageId = message.id;
  } catch (error) {
    // Only reached when nothing was committed, so the files are truly orphans.
    await Promise.all(stored.map((s) => deleteChatFile(s.key).catch(() => undefined)));
    throw error;
  }

  const members = await memberIdsOf(conversationId);
  await notifyMembers(conversationId, members, "message");
  // Bell notifications for @mentions and thread replies must never fail the send.
  await notifyMentionsAndThread({ actor, conversationId, members, body: sticker ? "" : body, replyToId, messageId }).catch((e) =>
    console.error("Chat notification failed:", e)
  );
  return { status: "ok" as const, message: await loadDto(messageId, actor.id) };
}

/**
 * Sends bell notifications like Slack does: to members @mentioned in the
 * message, and — for a thread reply — to the thread's author and everyone who
 * has replied in it. Nobody is notified about their own message.
 */
async function notifyMentionsAndThread(input: {
  actor: ChatActor;
  conversationId: string;
  members: string[];
  body: string;
  replyToId: string | null;
  messageId: string;
}) {
  const { actor, conversationId, members, body, replyToId } = input;
  const memberSet = new Set(members);
  const mentioned = mentionedIds(body).filter((id) => memberSet.has(id) && id !== actor.id);
  const text = body ? await plainText(body) : "";
  const preview = text.length > 140 ? `${text.slice(0, 140)}…` : text || "📎";
  const conv = await prisma.chatConversation.findUnique({ where: { id: conversationId }, select: { type: true, name: true } });
  const where = conv?.type === "dm" ? "رسالة خاصة" : `#${conv?.name ?? ""}`;

  if (mentioned.length) {
    await notifyUsers(mentioned, {
      title: `${actor.name} عمل لك منشن في ${where}`,
      message: preview,
      link: chatLink(conversationId, replyToId),
      type: "chat_mention",
      relatedId: input.messageId,
    });
  }

  if (replyToId) {
    const root = await prisma.chatMessage.findUnique({ where: { id: replyToId }, select: { senderId: true } });
    const repliers = await prisma.chatMessage.findMany({ where: { replyToId }, select: { senderId: true }, distinct: ["senderId"] });
    const followers = [root?.senderId, ...repliers.map((r) => r.senderId)].filter(
      (id): id is string => Boolean(id) && id !== actor.id && memberSet.has(id!) && !mentioned.includes(id!)
    );
    if (followers.length) {
      await notifyUsers(followers, {
        title: `${actor.name} رد في thread في ${where}`,
        message: preview,
        link: chatLink(conversationId, replyToId),
        type: "chat_thread",
        relatedId: input.messageId,
      });
    }
  }
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
  return { status: "ok" as const, message: await loadDto(messageId, actor.id) };
}

export async function deleteMessage(actor: ChatActor, messageId: string) {
  const found = await messageWithMembership(actor, messageId);
  if (!found) return { status: "not_found" as const };
  const { message, membership } = found;
  if (message.deletedAt) return { status: "ok" as const };
  const own = message.senderId === actor.id;
  const moderator = membership.conversation.type !== "dm" && isManager(membership.role);
  if (!own && !moderator) return { status: "forbidden" as const };
  // System lines and call records are history, not messages to retract.
  if (message.kind === "system" || message.kind === "call") return { status: "forbidden" as const };

  // Deleting a message really removes its files — a "deleted" photo must not
  // stay downloadable from a saved link.
  const attachments = await prisma.chatAttachment.findMany({ where: { messageId }, select: { id: true, storageKey: true } });
  await prisma.$transaction([
    prisma.chatAttachment.deleteMany({ where: { messageId } }),
    prisma.chatReaction.deleteMany({ where: { messageId } }),
    prisma.chatMessage.update({ where: { id: messageId }, data: { deletedAt: new Date(), body: null, stickerId: null, pinnedAt: null, pinnedById: null } }),
    // Mention/thread notifications carry a preview of the text — remove them too.
    prisma.notification.deleteMany({ where: { relatedId: messageId, type: { in: ["chat_mention", "chat_thread"] } } }),
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
  return { status: "ok" as const, message: await loadDto(messageId, actor.id) };
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

// ── Shared media (WhatsApp-style "media, docs") ─────────────────────────────

export const MEDIA_TABS = ["image", "video", "file", "voice"] as const;
export type MediaTab = (typeof MEDIA_TABS)[number];
const MEDIA_PAGE = 60;

function mediaWhere(conversationId: string, tab: MediaTab): Prisma.ChatAttachmentWhereInput {
  const live = { conversationId, messageId: { not: null }, message: { deletedAt: null } };
  const recorded = ["voice", "recording"];
  switch (tab) {
    case "image":
      return { ...live, category: "image" };
    case "video":
      return { ...live, category: "video", message: { deletedAt: null, kind: { notIn: recorded } } };
    case "voice":
      return { ...live, message: { deletedAt: null, kind: { in: recorded } } };
    default:
      return { ...live, category: { notIn: ["image", "video"] }, message: { deletedAt: null, kind: { notIn: recorded } } };
  }
}

/**
 * A conversation's shared photos, videos, files or voice notes, newest first,
 * with a count per tab. Paged by a (createdAt, id) cursor.
 */
export async function listMedia(actor: ChatActor, conversationId: string, params: { tab?: unknown; before?: unknown }) {
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  if (!allowAction(`media:${actor.id}`, 60, 60_000)) return { status: "rate_limited" as const };
  const tab: MediaTab = (MEDIA_TABS as readonly string[]).includes(params.tab as string) ? (params.tab as MediaTab) : "image";

  let cursor: { createdAt: Date; id: string } | null = null;
  if (typeof params.before === "string" && params.before) {
    const at = await prisma.chatAttachment.findFirst({ where: { id: params.before, conversationId }, select: { createdAt: true, id: true } });
    // An unknown cursor must not silently restart from the top (duplicates).
    if (!at) return { status: "invalid" as const, error: "Unknown cursor" };
    cursor = at;
  }
  const where = mediaWhere(conversationId, tab);
  const rows = await prisma.chatAttachment.findMany({
    where: cursor
      ? { AND: [where, { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }] }
      : where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MEDIA_PAGE + 1,
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      category: true,
      size: true,
      durationMs: true,
      waveform: true,
      createdAt: true,
      message: { select: { id: true, kind: true, replyToId: true, sender: { select: { id: true, name: true } } } },
    },
  });
  // Counts once per tab open (not per page), in a single query.
  let counts: Record<MediaTab, number> | null = null;
  if (!cursor) {
    const [c] = await prisma.$queryRaw<{ image: number; video: number; file: number; voice: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE a.category = 'image')::int AS image,
        COUNT(*) FILTER (WHERE a.category = 'video' AND m.kind NOT IN ('voice', 'recording'))::int AS video,
        COUNT(*) FILTER (WHERE a.category NOT IN ('image', 'video') AND m.kind NOT IN ('voice', 'recording'))::int AS file,
        COUNT(*) FILTER (WHERE m.kind IN ('voice', 'recording'))::int AS voice
      FROM "ChatAttachment" a
      JOIN "ChatMessage" m ON m.id = a."messageId"
      WHERE a."conversationId" = ${conversationId} AND m."deletedAt" IS NULL`;
    counts = { image: Number(c?.image ?? 0), video: Number(c?.video ?? 0), file: Number(c?.file ?? 0), voice: Number(c?.voice ?? 0) };
  }

  return {
    status: "ok" as const,
    tab,
    counts,
    hasMore: rows.length > MEDIA_PAGE,
    items: rows.slice(0, MEDIA_PAGE).map((r) => ({
      id: r.id,
      originalName: r.originalName,
      mimeType: r.mimeType,
      category: r.category,
      size: r.size,
      durationMs: r.durationMs,
      waveform: r.waveform,
      createdAt: r.createdAt.toISOString(),
      messageId: r.message!.id,
      messageKind: r.message!.kind,
      threadRootId: r.message!.replyToId,
      sender: r.message!.sender,
    })),
  };
}
