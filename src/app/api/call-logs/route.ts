import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { autoAssignLead } from "@/lib/autoAssign";

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

    const data = await req.json();
    const { leadId, callStatus, classification, notes, meetingDate, meetingTime } = data;
    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    if (!leadId || !callStatus || !notes) {
      return NextResponse.json({ error: "leadId, callStatus, and notes are required" }, { status: 400 });
    }

    const existingLead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const isAuthorized = 
      existingLead.assignedTeleAgentId === userId || 
      existingLead.assignedSalesAgentId === userId ||
      ["super_admin", "tele_sales_manager", "sales_manager"].includes(userRole);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: You are not assigned to this lead." }, { status: 403 });
    }

    // Create call log
    await prisma.callLog.create({
      data: {
        leadId,
        agentId: userId,
        callStatus,
        classification,
        notes,
        meetingDate: meetingDate ? new Date(meetingDate + "T" + (meetingTime || "00:00") + ":00Z") : null,
      }
    });

    // Determine the new lead status based on call outcome
    const statusMap: Record<string, string> = {
      "Busy": "No_Answer",
      "Wrong Number": "Closed_Lost",
      "Invalid": "Closed_Lost",
      "Accept and book meeting": "Transferred",
      "Accept but lost": "Closed_Lost",
      "Not Interested": "Closed_Lost",
    };

    const newStatus = statusMap[callStatus] || "Contacted";

    const updateData: any = {
      classification,
      status: newStatus,
    };

    if (callStatus === "Accept and book meeting" && meetingDate) {
      updateData.meetingDate = new Date(meetingDate + "T00:00:00Z");
      updateData.meetingTime = meetingTime;
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    // Create meeting record and trigger auto-assignment for booked meetings
    if (callStatus === "Accept and book meeting" && meetingDate) {
      await prisma.meeting.create({
        data: {
          leadId,
          teleAgentId: userId,
          meetingDate: new Date(meetingDate + "T" + (meetingTime || "00:00") + ":00Z"),
          meetingTime,
          status: "Scheduled",
        }
      });
      // Trigger auto-assignment engine asynchronously
      autoAssignLead(leadId).catch(console.error);
    }

    // Return the FULL lead with callLogs and related data so the frontend
    // can update its local state without losing the callLogs array
    const fullLead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        teleAgent: { select: { name: true } },
        salesAgent: { select: { name: true } },
        callLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json(fullLead, { status: 201 });
  } catch (error) {
    console.error("Failed to log call:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
