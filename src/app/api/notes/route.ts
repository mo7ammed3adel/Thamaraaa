import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/notes?projectId=xxx
 * Fetches all global notes for a project, ordered by newest first.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const notes = await prisma.note.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notes);
}

/**
 * POST /api/notes
 * Creates a new global note on a project.
 * Body: { projectId, content, category }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { projectId, content, category } = await req.json();

  if (!projectId || !content) {
    return NextResponse.json({ error: "projectId and content required" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: {
      projectId,
      userId: user.id,
      userRole: user.role,
      userName: user.name || "Unknown",
      content,
      category: category || "general",
    },
  });

  return NextResponse.json(note);
}
