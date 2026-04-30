import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canResolveWarning } from "@/lib/distribution";

/**
 * POST /api/warnings/[id]/resolve
 * Marks a warning as Resolved. Only the original sender can resolve their own warning.
 * Sets resolvedAt timestamp and resolvedByUserId, plus updates status to "Resolved".
 * Creates a ProjectLog entry for audit trail.
 *
 * @param req - The incoming request (no body required)
 * @param params.id - The warning ID to resolve
 * @returns 200 with updated warning on success
 * @returns 401 if not authenticated
 * @returns 403 if the user is not the warning sender
 * @returns 404 if warning not found
 * @returns 400 if warning is already resolved
 * @returns 500 on internal server error
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

    const warning = await prisma.warning.findUnique({
      where: { id: params.id },
    });

    if (!warning) {
      return NextResponse.json({ error: "Warning not found" }, { status: 404 });
    }

    if (warning.status === "Resolved") {
      return NextResponse.json(
        { error: "Warning is already resolved" },
        { status: 400 }
      );
    }

    if (!canResolveWarning(user.id, warning.senderUserId)) {
      return NextResponse.json(
        { error: "Only the warning creator can resolve this warning" },
        { status: 403 }
      );
    }

    const now = new Date();

    const updatedWarning = await prisma.$transaction(async (tx) => {
      const updated = await tx.warning.update({
        where: { id: params.id },
        data: {
          status: "Resolved",
          resolvedAt: now,
          resolvedByUserId: user.id,
        },
      });

      if (warning.projectId) {
        await tx.projectLog.create({
          data: {
            projectId: warning.projectId,
            userId: user.id,
            action: "warning_resolved",
            details: `Warning "${warning.subject}" resolved by ${user.name}`,
          },
        });
      }

      return updated;
    });

    return NextResponse.json({ success: true, warning: updatedWarning });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Resolve Warning Error:", message);
    return NextResponse.json(
      { error: "Internal Server Error", details: message },
      { status: 500 }
    );
  }
}
