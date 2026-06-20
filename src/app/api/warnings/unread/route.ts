import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;

    const receipts = await prisma.warningReceipt.findMany({
      where: { userId: user.id, isRead: false, warning: { status: { not: "Resolved" } } },
      include: {
        warning: {
          include: { sender: { select: { id: true, name: true, role: true } } }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    const warnings = receipts.map((r: any) => ({
      id: r.warning.id,
      subject: r.warning.subject,
      message: r.warning.message,
      severity: r.warning.severity,
      senderName: r.warning.sender.name,
      senderRole: r.warning.sender.role,
      createdAt: r.warning.createdAt,
      receiptId: r.id
    }));

    return NextResponse.json({ warnings });
  } catch (error: any) {
    console.error("Fetch Unread Warnings Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
