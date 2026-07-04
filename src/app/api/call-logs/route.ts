import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logLeadCall } from "@/server/services/leadService";

/**
 * POST /api/call-logs
 * Logs a call for a lead and updates lead status accordingly.
 * Returns the full lead with callLogs included so the frontend
 * can update its local state without losing related data.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const user = session.user as any;
    const result = await logLeadCall({
      user: { id: user.id, role: user.role, name: user.name },
      body: await req.json(),
    });

    if (result.status === "missing_fields") {
      return NextResponse.json({ error: "leadId, callStatus, and notes are required" }, { status: 400 });
    }
    if (result.status === "past_meeting_date") {
      return NextResponse.json({ error: "Meeting date cannot be in the past." }, { status: 400 });
    }
    if (result.status === "not_found") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden: You are not assigned to this lead." }, { status: 403 });
    }

    return NextResponse.json(result.lead, { status: 201 });
  } catch (error) {
    console.error("Failed to log call:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
