import type { AutoAssignLeadResult } from "@/lib/autoAssign";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { distributeLeadMeeting } from "@/server/services/leadService";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await distributeLeadMeeting({
      id: params.id,
      user: { id: user.id, role: user.role, name: user.name },
    });

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden: You cannot distribute this meeting." }, { status: 403 });
    }
    if (result.status === "no_booked_meeting") {
      return NextResponse.json({ error: "No booked meeting found for this lead." }, { status: 400 });
    }
    if (result.status === "not_ready") {
      return NextResponse.json({ error: "This lead is not ready for manual meeting distribution." }, { status: 400 });
    }
    if (result.status === "already_distributed") {
      return NextResponse.json({ error: "This meeting is already distributed." }, { status: 409 });
    }
    if (result.status === "auto_assign_failed") {
      return NextResponse.json(
        { error: describeAutoAssignFailure(result.result), result: result.result },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, result: result.result, lead: result.lead });
  } catch (error) {
    console.error("Failed to distribute meeting:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Turns an auto-assign failure into a message the Tele Sales manager can act on.
 * An empty roster is a setup problem to fix; everyone being busy or absent is a
 * transient state that clears on its own, so the two read differently.
 */
function describeAutoAssignFailure(result: AutoAssignLeadResult): string {
  if (result.assigned) return "";

  if (result.reason === "no_sales_agents_in_company") {
    const company = result.companyName ? `"${result.companyName}"` : "this client's company";
    return `No sales agent belongs to ${company}, so the lead was moved to Waiting. Add a sales agent to that company, or move the client to a company that has one — retrying will not help on its own.`;
  }

  if (result.reason === "no_available_sales_agents") {
    const { total, absent, busy, inMeeting } = result.blockers;
    const parts: string[] = [];
    if (absent > 0) parts.push(`${absent} not checked in`);
    if (busy > 0) parts.push(`${busy} marked busy`);
    if (inMeeting > 0) parts.push(`${inMeeting} inside a meeting`);
    const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
    return `All ${total} sales agents are unavailable right now${detail}. The lead was moved to Waiting — distribute it again once someone is free.`;
  }

  return "Lead not found";
}
