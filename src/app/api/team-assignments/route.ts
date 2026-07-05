import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listTeamAssignments, removeTeamAssignment } from "@/server/services/projectDistributionService";

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
    const user = session.user as { id: string; role: string };

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const result = await listTeamAssignments({ userId: user.id, userRole: user.role, projectId });
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ assignments: result.assignments });
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

    const result = await removeTeamAssignment({
      actor: { id: user.id, role: user.role, name: user.name },
      assignmentId,
    });

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden: you cannot remove this team assignment" }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Team assignment removal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
