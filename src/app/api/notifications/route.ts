import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ data: notifications }, { status: 200 });
  } catch (err: any) {
    console.error("Notifications API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
