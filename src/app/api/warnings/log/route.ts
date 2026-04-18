import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userRole = (session.user as any).role;

    if (!["head_account_manager", "head_technical", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: Only admins can view the warning log" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const severity = searchParams.get("severity");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let where: any = {};
    if (projectId) where.projectId = projectId;
    if (severity && severity !== "All") where.severity = severity;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const warnings = await prisma.warning.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receipts: { include: { user: { select: { id: true, name: true, role: true } } } },
        project: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ warnings });
  } catch (error: any) {
    console.error("Fetch Warnings Log Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
