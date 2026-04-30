import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;

    const receipt = await prisma.warningReceipt.findUnique({
      where: { warningId_userId: { warningId: params.id, userId: user.id } }
    });

    if (!receipt) return NextResponse.json({ error: "Warning receipt not found" }, { status: 404 });
    if (receipt.isRead) return NextResponse.json({ error: "Warning already acknowledged" }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      const rec = await tx.warningReceipt.update({
        where: { id: receipt.id },
        data: { isRead: true, readAt: new Date() }
      });

      await tx.projectLog.create({
        data: {
          projectId: (await tx.warning.findUnique({ where: { id: params.id } }))?.projectId || "",
          userId: user.id,
          action: "warning_read",
          details: `Warning acknowledged by ${user.name}`
        }
      });

      return rec;
    });

    return NextResponse.json({ success: true, receipt: updated });
  } catch (error: any) {
    console.error("Acknowledge Warning Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
