import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/team-assignments?projectId=xxx
 * Returns all active team assignments for a given project.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const assignments = await prisma.teamAssignment.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, role: true, email: true } },
        assignedByUser: { select: { id: true, name: true, role: true } },
      },
      orderBy: { assignedAt: "desc" },
    });

    return NextResponse.json({ assignments });
  } catch (error: unknown) {
    console.error("Team assignments fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/team-assignments?assignmentId=xxx
 * Removes a team assignment (sets status to "removed" and records removedAt).
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; name: string };
    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId required" }, { status: 400 });
    }

    const assignment = await prisma.teamAssignment.findUnique({
      where: { id: assignmentId },
      include: { user: { select: { name: true, role: true } } },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.teamAssignment.update({
        where: { id: assignmentId },
        data: { status: "removed", removedAt: new Date() },
      }),
      prisma.projectLog.create({
        data: {
          projectId: assignment.projectId,
          action: "team_removed",
          details: JSON.stringify({
            removedUser: assignment.user.name,
            removedRole: assignment.user.role,
            removedBy: user.name,
          }),
          userId: user.id,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Team assignment removal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
