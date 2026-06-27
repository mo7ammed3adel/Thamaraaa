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
      const message =
        result.result.reason === "no_available_sales_agents"
          ? "No available sales agents right now. The lead was moved to Waiting."
          : "Lead not found";
      return NextResponse.json({ error: message, result: result.result }, { status: 409 });
    }

    return NextResponse.json({ success: true, result: result.result, lead: result.lead });
  } catch (error) {
    console.error("Failed to distribute meeting:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
