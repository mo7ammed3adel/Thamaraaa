import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/warnings/[id]/acknowledge - Acknowledge a warning
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const warning = await prisma.warning.findUnique({ where: { id: params.id } });
  if (!warning) return NextResponse.json({ error: "Warning not found" }, { status: 404 });

  let ackList: any[] = [];
  try { ackList = JSON.parse(warning.acknowledgedBy); } catch {}

  // Check if already acknowledged
  if (ackList.some((a: any) => a.userId === user.id)) {
    return NextResponse.json({ message: "Already acknowledged" });
  }

  ackList.push({
    userId: user.id,
    userName: user.name,
    role: user.role,
    timestamp: new Date().toISOString(),
  });

  const updated = await prisma.warning.update({
    where: { id: params.id },
    data: { acknowledgedBy: JSON.stringify(ackList) },
  });

  // Notify sender that someone acknowledged
  try {
    const { pusherServer } = await import("@/lib/pusher");
    if (pusherServer) {
      await pusherServer.trigger("warnings-channel", "warning-acknowledged", {
        warningId: params.id,
        acknowledgedBy: { userId: user.id, userName: user.name, role: user.role },
      });
    }
  } catch (e) {
    console.error("Pusher ack broadcast error:", e);
  }

  return NextResponse.json(updated);
}
