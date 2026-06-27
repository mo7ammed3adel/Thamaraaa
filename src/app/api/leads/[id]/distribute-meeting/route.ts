import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoAssignLead } from "@/lib/autoAssign";
import { canManuallyDistributeMeeting } from "@/lib/meetingDistribution";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        teleAgent: { select: { directManagerId: true } },
        meetings: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, salesAgentId: true },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const isAuthorized =
      lead.assignedTeleAgentId === user.id ||
      user.role === "super_admin" ||
      (user.role === "tele_sales_manager" &&
        (!lead.assignedTeleAgentId || lead.teleAgent?.directManagerId === user.id));

    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: You cannot distribute this meeting." }, { status: 403 });
    }

    const latestMeeting = lead.meetings[0];
    if (!latestMeeting || !lead.meetingDate) {
      return NextResponse.json({ error: "No booked meeting found for this lead." }, { status: 400 });
    }

    if (!canManuallyDistributeMeeting(lead)) {
      return NextResponse.json({ error: "This lead is not ready for manual meeting distribution." }, { status: 400 });
    }

    if (lead.assignedSalesAgentId || latestMeeting.salesAgentId) {
      return NextResponse.json({ error: "This meeting is already distributed." }, { status: 409 });
    }

    const result = await autoAssignLead(params.id);
    if (!result.assigned) {
      const message =
        result.reason === "no_available_sales_agents"
          ? "No available sales agents right now. The lead was moved to Waiting."
          : "Lead not found";
      return NextResponse.json({ error: message, result }, { status: 409 });
    }

    const updatedLead = await prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        teleAgent: { select: { name: true } },
        salesAgent: { select: { name: true } },
        callLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json({ success: true, result, lead: updatedLead });
  } catch (error) {
    console.error("Failed to distribute meeting:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
