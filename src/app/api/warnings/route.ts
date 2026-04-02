import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/warnings - List warnings for current user's role
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const warnings = await prisma.warning.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Filter warnings where user's role is in recipientRoles
  const filtered = warnings.filter((w: any) => {
    try {
      const roles = JSON.parse(w.recipientRoles);
      return roles.includes(user.role) || w.senderUserId === user.id;
    } catch {
      return false;
    }
  });

  // Check which ones user has acknowledged
  const result = filtered.map((w: any) => {
    let ackList: any[] = [];
    try { ackList = JSON.parse(w.acknowledgedBy); } catch {}
    const userAcknowledged = ackList.some((a: any) => a.userId === user.id);
    return { ...w, userAcknowledged, ackList };
  });

  return NextResponse.json(result);
}

// POST /api/warnings - Create a new warning
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
  const { message, clientId, projectId, recipientRoles } = body;

  if (!message || !recipientRoles || !Array.isArray(recipientRoles)) {
    return NextResponse.json({ error: "message and recipientRoles[] required" }, { status: 400 });
  }

  const warning = await prisma.warning.create({
    data: {
      message,
      clientId: clientId || null,
      projectId: projectId || null,
      senderUserId: user.id,
      senderRole: user.role,
      recipientRoles: JSON.stringify(recipientRoles),
    },
  });

  // Trigger Pusher notification for real-time delivery
  try {
    const { pusherServer } = await import("@/lib/pusher");
    if (pusherServer) {
      await pusherServer.trigger("warnings-channel", "new-warning", {
        id: warning.id,
        message: warning.message,
        senderRole: warning.senderRole,
        senderUserId: warning.senderUserId,
        recipientRoles,
        createdAt: warning.createdAt,
      });
    }
  } catch (e) {
    console.error("Pusher warning broadcast error:", e);
  }

  return NextResponse.json(warning);
}
