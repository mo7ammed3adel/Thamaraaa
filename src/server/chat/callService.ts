import { AccessToken, RoomServiceClient, WebhookReceiver } from "livekit-server-sdk";
import { prisma } from "@/lib/prisma";
import { pusherConfigured, pusherServer } from "@/lib/pusher";
import { notifyUsers } from "@/lib/notify";
import { STALE_CALL_GRACE_MS, callIdFromRoom, callRings, callRoomName, isMissedCall } from "@/lib/chat/media";
import { chatChannelFor, findMembership, memberIdsOf, notifyMembers, type ChatActor } from "./chatService";
import { allowAction } from "./rateLimit";

/**
 * Voice/video calls. Media flows browser ↔ the self-hosted LiveKit server;
 * this module only decides who may join which room, keeps the ChatCall record
 * and tells members about it over the existing private chat channel.
 *
 * - LIVEKIT_URL is how the app reaches LiveKit (inside Docker, by name).
 * - LIVEKIT_PUBLIC_URL is the wss:// address browsers use (through Caddy).
 */
const apiKey = process.env.LIVEKIT_API_KEY || "";
const apiSecret = process.env.LIVEKIT_API_SECRET || "";
const internalUrl = process.env.LIVEKIT_URL || "";
const publicUrl = process.env.LIVEKIT_PUBLIC_URL || "";

export const callsConfigured = Boolean(apiKey && apiSecret && internalUrl && publicUrl);

let roomService: RoomServiceClient | null = null;
function rooms(): RoomServiceClient {
  roomService ??= new RoomServiceClient(internalUrl, apiKey, apiSecret);
  return roomService;
}

/** LiveKit calls must never hang a request; a slow server counts as unknown. */
async function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("LiveKit timed out")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** The ids-only call signal, on each member's private chat channel. */
async function signal(userIds: string[], data: { kind: "ring" | "state" | "declined"; conversationId: string; callId: string; userId?: string }) {
  if (!pusherConfigured || userIds.length === 0) return;
  const channels = Array.from(new Set(userIds)).map(chatChannelFor);
  try {
    for (let i = 0; i < channels.length; i += 100) await pusherServer.trigger(channels.slice(i, i + 100), "call", data);
  } catch (error) {
    console.error("Call signal failed:", error);
  }
}

async function issueToken(actor: ChatActor, callId: string): Promise<string> {
  // Short-lived: LiveKit refreshes it for connected participants, so a saved
  // token can't be replayed later by someone who has since been removed.
  const token = new AccessToken(apiKey, apiSecret, { identity: actor.id, name: actor.name, ttl: "10m" });
  token.addGrant({
    room: callRoomName(callId),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // No canUpdateOwnMetadata: it would let a participant rename themselves.
    // The "recording" flag is set by the server instead (setRecordingFlag).
  });
  return token.toJwt();
}

export type LiveParticipant = { id: string; name: string };

/**
 * Who is in the room right now; null when LiveKit can't be asked. Cached for a
 * few seconds (and shared while in flight): every member's open chat asks when
 * someone joins, and that must not become one LiveKit request each.
 */
const participantCache = new Map<string, { at: number; value: Promise<LiveParticipant[] | null> }>();
const PARTICIPANT_CACHE_MS = 4000;

function liveParticipants(callId: string, fresh = false): Promise<LiveParticipant[] | null> {
  const hit = participantCache.get(callId);
  if (!fresh && hit && Date.now() - hit.at < PARTICIPANT_CACHE_MS) return hit.value;
  const value = fetchParticipants(callId);
  participantCache.set(callId, { at: Date.now(), value });
  if (participantCache.size > 500) {
    for (const [k, v] of Array.from(participantCache)) if (Date.now() - v.at > PARTICIPANT_CACHE_MS) participantCache.delete(k);
  }
  return value;
}

async function fetchParticipants(callId: string): Promise<LiveParticipant[] | null> {
  try {
    const list = await withTimeout(rooms().listParticipants(callRoomName(callId)));
    return list.map((p) => ({ id: p.identity, name: p.name || "—" }));
  } catch (error) {
    // Asking about a room that no longer exists is a "not found" — empty.
    if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 404) return [];
    const message = error instanceof Error ? error.message : String(error);
    if (/not.?found|does not exist/i.test(message)) return [];
    return null;
  }
}

/**
 * Closes a call once. Safe to call from several places at the same time
 * (webhook, a leaving client, a stale check): only the first one wins.
 */
export async function endCall(callId: string, reason: "room_finished" | "abandoned" | "declined" | "stale"): Promise<boolean> {
  const closed = await prisma.chatCall.updateMany({ where: { id: callId, endedAt: null }, data: { endedAt: new Date() } });
  if (closed.count === 0) return false;

  const call = await prisma.chatCall.findUnique({
    where: { id: callId },
    include: { conversation: { select: { type: true } }, startedBy: { select: { name: true } } },
  });
  if (!call) return true;

  participantCache.delete(callId);
  if (reason !== "room_finished") {
    // The record and the room must agree: nobody stays talking in a call the
    // record says is over (they get disconnected and see "call ended").
    await withTimeout(rooms().deleteRoom(callRoomName(callId))).catch(() => undefined);
  }

  const members = await memberIdsOf(call.conversationId);
  await signal(members, { kind: "state", conversationId: call.conversationId, callId });
  await notifyMembers(call.conversationId, members, "message");

  if (isMissedCall(call, call.conversation.type) && reason !== "declined") {
    const missedBy = members.filter((id) => id !== call.startedById);
    await notifyUsers(missedBy, {
      title: "مكالمة فايتة",
      message: `${call.startedBy?.name ?? "حد"} كلّمك ${call.video ? "فيديو" : "صوت"} ومردّتش`,
      link: `/dashboard/chat?c=${call.conversationId}`,
      type: "chat_missed_call",
      relatedId: call.id,
    }).catch((e) => console.error("Missed-call notification failed:", e));
  }
  return true;
}

/**
 * The conversation's ongoing call, if any. A call whose room has emptied (or
 * never formed) is closed here, so a lost webhook can't leave one "live".
 */
export async function activeCallFor(conversationId: string) {
  const call = await prisma.chatCall.findFirst({
    where: { conversationId, endedAt: null },
    orderBy: { startedAt: "desc" },
    select: { id: true, video: true, startedAt: true, startedById: true },
  });
  if (!call || !callsConfigured) return null;

  const stale = Date.now() - call.startedAt.getTime() > STALE_CALL_GRACE_MS;
  let participants = await liveParticipants(call.id);
  // Before closing a call as dead, ask again rather than trust the cache.
  if (stale && participants?.length === 0) participants = await liveParticipants(call.id, true);
  if (participants !== null && participants.length === 0 && stale) {
    await endCall(call.id, "stale");
    return null;
  }
  return {
    id: call.id,
    video: call.video,
    startedAt: call.startedAt.toISOString(),
    startedById: call.startedById,
    participants: participants ?? [],
  };
}

export type ActiveCall = NonNullable<Awaited<ReturnType<typeof activeCallFor>>>;

/**
 * Starts a call in a conversation, or joins the one already going — there is
 * at most one live call per conversation. Returns a LiveKit token.
 */
export async function startOrJoinCall(actor: ChatActor, conversationId: string, input: { video?: unknown; callId?: unknown }) {
  if (!callsConfigured) return { status: "invalid" as const, error: "Calls are not configured" };
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  const type = membership.conversation.type;

  if (type === "dm") {
    const others = await prisma.chatMember.findMany({
      where: { conversationId, NOT: { userId: actor.id } },
      include: { user: { select: { status: true } } },
    });
    if (others.some((o) => o.user.status !== "Active")) return { status: "forbidden" as const };
  }
  if (!allowAction(`call:${actor.id}`, 12, 60_000)) return { status: "rate_limited" as const };

  // Close a dead call first, so the button starts a fresh one instead of
  // dropping the caller into an empty room that's about to be closed.
  await activeCallFor(conversationId);

  const video = input.video === true;
  // Answering a ring / pressing Join names the call it means. If that call is
  // over, say so: never quietly start a new one that rings the caller back.
  const expected = typeof input.callId === "string" && input.callId ? input.callId : null;
  const outcome = await prisma.$transaction(async (tx) => {
    // Two members pressing "call" at once must end up in the same call.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`chat-call:${conversationId}`}))`;
    const existing = await tx.chatCall.findFirst({ where: { conversationId, endedAt: null }, orderBy: { startedAt: "desc" } });
    if (expected && existing?.id !== expected) return null;
    if (existing) return { call: existing, created: false };

    const now = new Date();
    const fresh = await tx.chatCall.create({
      data: { conversationId, startedById: actor.id, video, startedAt: now, participantIds: [actor.id] },
    });
    await tx.chatMessage.create({ data: { conversationId, senderId: actor.id, kind: "call", callId: fresh.id, createdAt: now } });
    await tx.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
    await tx.chatMember.update({ where: { id: membership.id }, data: { lastReadAt: now } });
    return { call: fresh, created: true };
  });
  if (!outcome) return { status: "invalid" as const, error: "call_ended" };
  const { call, created } = outcome;

  if (!created) {
    await prisma.$executeRaw`
      UPDATE "ChatCall" SET "participantIds" = array_append("participantIds", ${actor.id})
      WHERE id = ${call.id} AND NOT (${actor.id} = ANY("participantIds"))`;
  } else {
    // Short timeouts: an empty room closes quickly, which ends the call.
    await withTimeout(
      rooms().createRoom({ name: callRoomName(call.id), emptyTimeout: 60, departureTimeout: 15, maxParticipants: 50 })
    ).catch((e) => console.error("LiveKit createRoom failed:", e));
  }

  const token = await issueToken(actor, call.id);
  const members = await memberIdsOf(conversationId);
  if (created) {
    await notifyMembers(conversationId, members, "message");
    const others = members.filter((id) => id !== actor.id);
    await signal(callRings(type) ? others : [], { kind: "ring", conversationId, callId: call.id });
  } else {
    // Your other tabs stop ringing now that you picked up here. Everyone
    // else refreshes from the participant_joined webhook once you're in.
    await signal([actor.id], { kind: "state", conversationId, callId: call.id, userId: actor.id });
  }

  return {
    status: "ok" as const,
    join: { callId: call.id, conversationId, video: call.video, url: publicUrl, token, created },
  };
}

/** What an incoming-call card needs: who is calling, from where. */
export async function getCallInfo(actor: ChatActor, callId: string) {
  const call = await prisma.chatCall.findUnique({
    where: { id: callId },
    include: { startedBy: { select: { id: true, name: true } }, conversation: { select: { id: true, type: true, name: true } } },
  });
  if (!call) return { status: "not_found" as const };
  const membership = await findMembership(call.conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  return {
    status: "ok" as const,
    call: {
      id: call.id,
      conversationId: call.conversationId,
      conversationType: call.conversation.type,
      conversationName: call.conversation.type === "dm" ? call.startedBy?.name ?? "—" : call.conversation.name,
      startedBy: call.startedBy,
      video: call.video,
      startedAt: call.startedAt.toISOString(),
      active: !call.endedAt,
    },
  };
}

/**
 * Declining a DM call ends it (there's no one else to talk to). In a group it
 * only silences the ring on your other tabs.
 */
export async function declineCall(actor: ChatActor, callId: string) {
  const call = await prisma.chatCall.findUnique({ where: { id: callId }, include: { conversation: { select: { type: true } } } });
  if (!call) return { status: "not_found" as const };
  const membership = await findMembership(call.conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  if (call.endedAt) return { status: "ok" as const };

  const members = await memberIdsOf(call.conversationId);
  if (call.conversation.type === "dm" && !call.participantIds.includes(actor.id)) {
    await signal(members, { kind: "declined", conversationId: call.conversationId, callId, userId: actor.id });
    await endCall(callId, "declined");
  } else {
    await signal([actor.id], { kind: "declined", conversationId: call.conversationId, callId, userId: actor.id });
  }
  return { status: "ok" as const };
}

/**
 * A client says it hung up. Only one case ends the call right away: the caller
 * giving up before anyone else ever joined (a cancelled ring), so the callee
 * stops ringing at once. Otherwise LiveKit's room_finished webhook ends it when
 * the room is really empty: a list of who is connected can briefly miss
 * someone who is reconnecting, so it is not trusted to end a call.
 */
export async function leaveCall(actor: ChatActor, callId: string) {
  const call = await prisma.chatCall.findUnique({
    where: { id: callId },
    select: { conversationId: true, endedAt: true, startedById: true, participantIds: true },
  });
  if (!call) return { status: "not_found" as const };
  const membership = await findMembership(call.conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  if (call.endedAt || !call.participantIds.includes(actor.id)) return { status: "ok" as const };

  const nobodyElseJoined = new Set(call.participantIds).size === 1;
  if (call.startedById === actor.id && nobodyElseJoined) {
    await endCall(callId, "abandoned");
  } else {
    participantCache.delete(callId);
    await signal(await memberIdsOf(call.conversationId), { kind: "state", conversationId: call.conversationId, callId });
  }
  return { status: "ok" as const };
}

/** The red "recording" badge, set by the server so clients cannot fake names. */
export async function setRecordingFlag(actor: ChatActor, callId: string, on: unknown) {
  const call = await prisma.chatCall.findUnique({ where: { id: callId }, select: { conversationId: true, endedAt: true, participantIds: true } });
  if (!call) return { status: "not_found" as const };
  const membership = await findMembership(call.conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  if (call.endedAt || !call.participantIds.includes(actor.id)) return { status: "forbidden" as const };
  try {
    await withTimeout(rooms().updateParticipant(callRoomName(callId), actor.id, { attributes: { recording: on === true ? "1" : "" } }));
  } catch (error) {
    console.error("Recording flag failed:", error);
    return { status: "invalid" as const, error: "Not connected to the call" };
  }
  return { status: "ok" as const };
}

/** Someone removed from a conversation is taken out of its live call too. */
export async function removeFromLiveCalls(conversationId: string, userId: string): Promise<void> {
  if (!callsConfigured) return;
  const calls = await prisma.chatCall.findMany({ where: { conversationId, endedAt: null }, select: { id: true } });
  for (const c of calls) {
    await withTimeout(rooms().removeParticipant(callRoomName(c.id), userId)).catch(() => undefined);
    participantCache.delete(c.id);
  }
}

let receiver: WebhookReceiver | null = null;

/** LiveKit's signed webhook: room_finished ends the call; joins/leaves refresh it. */
export async function handleLiveKitWebhook(body: string, authHeader: string | null) {
  if (!callsConfigured) return { status: "not_found" as const };
  receiver ??= new WebhookReceiver(apiKey, apiSecret);
  let event;
  try {
    event = await receiver.receive(body, authHeader ?? undefined);
  } catch {
    return { status: "forbidden" as const };
  }
  const callId = callIdFromRoom(event.room?.name);
  if (!callId) return { status: "ok" as const };

  if (event.event === "room_finished") {
    await endCall(callId, "room_finished");
  } else if (event.event === "participant_joined" || event.event === "participant_left") {
    participantCache.delete(callId);
    const call = await prisma.chatCall.findUnique({ where: { id: callId }, select: { conversationId: true, endedAt: true } });
    if (call && !call.endedAt) {
      await signal(await memberIdsOf(call.conversationId), {
        kind: "state",
        conversationId: call.conversationId,
        callId,
        // Lets your other tabs stop ringing once you have joined from one.
        userId: event.event === "participant_joined" ? event.participant?.identity : undefined,
      });
    }
  }
  return { status: "ok" as const };
}

/** Recording uploads must belong to a call in this conversation that you were in. */
export async function canAttachRecording(actorId: string, conversationId: string, callId: unknown): Promise<boolean> {
  if (typeof callId !== "string" || !callId) return false;
  const call = await prisma.chatCall.findUnique({ where: { id: callId }, select: { conversationId: true, participantIds: true } });
  return Boolean(call && call.conversationId === conversationId && call.participantIds.includes(actorId));
}
