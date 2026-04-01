import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { autoAssignLead } from "@/lib/autoAssign";

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
    const callLog = await prisma.callLog.create({
      data: {
        leadId,
        agentId: (session.user as any).id,
        callStatus,
        classification,
        notes,
        meetingDate: meetingDate ? new Date(meetingDate + "T" + (meetingTime || "00:00") + ":00Z") : null,
      }
    });

    // Update lead status
    const updateData: any = {
      classification,
      status: "Contacted"
    };

    if (callStatus === "Busy" || callStatus === "Wrong Number") updateData.status = "No_Answer";
    if (callStatus === "Accept and book meeting") updateData.status = "Transferred";

    if (callStatus === "Accept and book meeting" && meetingDate) {
      updateData.meetingDate = new Date(meetingDate + "T00:00:00Z");
      updateData.meetingTime = meetingTime;
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData
    });

    if (callStatus === "Accept and book meeting") {
      if (meetingDate) {
        await prisma.meeting.create({
          data: {
            leadId,
            teleAgentId: (session.user as any).id,
            meetingDate: new Date(meetingDate + "T" + (meetingTime || "00:00") + ":00Z"),
            meetingTime,
            status: "Scheduled"
          }
        });
      }
      // Trigger auto-assignment engine asynchronously
      autoAssignLead(leadId).catch(console.error);
    }

    return NextResponse.json(updatedLead, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
