import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reassignAccountManager } from "@/server/services/projectDistributionService";

/** Roles allowed to reassign a client between Account Managers */
const ALLOWED_ROLES = ["head_account_manager", "super_admin"];

/**
 * POST /api/projects/[id]/reassign-am
 * Transfers a client (project) from one Account Manager Agent to another.
 * Only the Head Account Manager or super_admin can perform this action.
 * All client history (notes, tasks, team assignments, warnings) is preserved.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as { id: string; name: string; role: string };

    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: "Only the Head Account Manager can reassign clients" },
        { status: 403 }
      );
    }

    const result = await reassignAccountManager({
      actor: { id: user.id, name: user.name },
      projectId: params.id,
      body: await req.json(),
    });

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (result.status === "missing_id") {
      return NextResponse.json({ error: "newAccountManagerId is required" }, { status: 400 });
    }
    if (result.status === "am_not_found") {
      return NextResponse.json({ error: "Selected Account Manager not found" }, { status: 400 });
    }
    if (result.status === "invalid_am") {
      return NextResponse.json({ error: "Selected user is not an active Account Manager" }, { status: 400 });
    }

    return NextResponse.json({ success: true, project: result.project });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Reassign AM Error:", message);
    return NextResponse.json(
      { error: "Internal Server Error", details: message },
      { status: 500 }
    );
  }
}
