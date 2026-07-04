import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { decideAttendanceDeduction, recordAttendanceAction } from "@/server/services/hrService";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const userId = (session.user as any).id;

    const { action } = await req.json(); // "checkIn" or "checkOut"

    const result = await recordAttendanceAction({ userId, action });

    if (result.status === "already_checked_in") {
      return NextResponse.json({ error: "Already checked in today" }, { status: 400 });
    }
    if (result.status === "no_active_check_in") {
      return NextResponse.json({ error: "No active check-in or already checked out" }, { status: 400 });
    }
    if (result.status === "invalid_action") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (result.status === "checked_in") {
      return NextResponse.json(result.record, { status: 201 });
    }
    return NextResponse.json(result.record, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/attendance
 * HR approves, rejects, or edits a drafted lateness deduction.
 * Only an approved deduction should be picked up by payroll.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== "hr_manager" && role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, action, deductionDraft } = await req.json();

    const result = await decideAttendanceDeduction({ id, action, deductionDraft });

    if (result.status === "missing_fields") {
      return NextResponse.json({ error: "id and action are required" }, { status: 400 });
    }
    if (result.status === "invalid_action") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json(result.record, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
