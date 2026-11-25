import { NextResponse } from "next/server";
import { pusherConfigured, pusherServer } from "@/lib/pusher";
import { chatChannelFor } from "@/server/chat/chatService";
import { requireChatActor } from "@/server/chat/routeHelpers";
import { errorJson } from "@/server/http/responses";

/**
 * Pusher private-channel auth. A user is only ever signed for their own chat
 * channel, so nobody can subscribe to someone else's notifications.
 */
export async function POST(request: Request) {
  if (!pusherConfigured) return errorJson("Realtime is not configured", 404);
  const auth = await requireChatActor();
  if ("response" in auth) return auth.response;

  const form = new URLSearchParams(await request.text());
  const socketId = form.get("socket_id") || "";
  const channel = form.get("channel_name") || "";
  if (!socketId || channel !== chatChannelFor(auth.actor.id)) return errorJson("Forbidden", 403);

  return NextResponse.json(pusherServer.authorizeChannel(socketId, channel));
}
