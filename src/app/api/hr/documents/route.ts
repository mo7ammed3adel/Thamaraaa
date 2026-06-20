import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeWebUrl } from "@/lib/safe-url";

const HR_ROLES = ["super_admin", "hr_manager"];

/**
 * GET /api/hr/documents?userId=...   — list documents for one user (owner or HR)
 * GET /api/hr/documents              — list all documents (HR only)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id: string; role: string } | undefined;
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userIdParam = searchParams.get("userId");
  const isHr = HR_ROLES.includes(sessionUser.role);

  // Non-HR users may only fetch their own documents.
  const targetUserId = userIdParam || sessionUser.id;
  if (!isHr && targetUserId !== sessionUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const documents = await prisma.employeeDocument.findMany({
      where: targetUserId ? { userId: targetUserId } : undefined,
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ documents });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR documents GET error:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/hr/documents — upload a document. HR may upload for any user; others only for themselves.
 * Body: { userId?: string, name: string, fileUrl: string }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id: string; role: string } | undefined;
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, name, fileUrl } = body || {};
  const safeFileUrl = normalizeWebUrl(fileUrl);
  const safeName = typeof name === "string" ? name.trim().slice(0, 120) : "";
  if (!safeName || !safeFileUrl) {
    return NextResponse.json({ error: "name and fileUrl are required" }, { status: 400 });
  }

  const isHr = HR_ROLES.includes(sessionUser.role);
  const targetUserId = userId || sessionUser.id;
  if (!isHr && targetUserId !== sessionUser.id) {
    return NextResponse.json({ error: "Forbidden: cannot upload for another user" }, { status: 403 });
  }

  try {
    const document = await prisma.employeeDocument.create({
      data: { userId: targetUserId, name: safeName, fileUrl: safeFileUrl },
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR documents POST error:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/hr/documents?id=... — HR-only.
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id: string; role: string } | undefined;
  if (!sessionUser || !HR_ROLES.includes(sessionUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await prisma.employeeDocument.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR documents DELETE error:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
