import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCanAccessProject } from "@/lib/distribution";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: string };

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const category = searchParams.get("department") || searchParams.get("category");
  const authorUserId = searchParams.get("author");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const allowed = await userCanAccessProject(user.id, user.role, projectId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const whereClause: any = { projectId };
    
    if (category && category !== "all") {
      whereClause.category = category;
    }
    if (authorUserId && authorUserId !== "all") {
      whereClause.userId = authorUserId;
    }
    
    if (from || to) {
      whereClause.createdAt = {};
      if (from) whereClause.createdAt.gte = new Date(from);
      if (to) whereClause.createdAt.lte = new Date(to);
    }

    const totalCount = await prisma.note.count({ where: whereClause });
    const notes = await prisma.note.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    
    return NextResponse.json({ 
      notes, 
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: string; name: string };

  try {
    const body = await req.json();
    const { projectId, content, category } = body;

    if (!projectId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const allowed = await userCanAccessProject(user.id, user.role, projectId);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const note = await prisma.note.create({
      data: {
        projectId,
        content,
        category: category || "general",
        userId: user.id,
        userRole: user.role,
        userName: user.name,
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Failed to create note:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
