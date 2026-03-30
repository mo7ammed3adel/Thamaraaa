import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { status, notes, assignedSalesAgentId, assignedTeleAgentId, followUpDate, meetingDate, meetingTime } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (assignedSalesAgentId !== undefined) updateData.assignedSalesAgentId = assignedSalesAgentId;
    if (assignedTeleAgentId !== undefined) updateData.assignedTeleAgentId = assignedTeleAgentId;
    if (followUpDate !== undefined) updateData.followUpDate = new Date(followUpDate);
    if (meetingDate !== undefined) updateData.meetingDate = new Date(meetingDate + "T00:00:00Z");
    if (meetingTime !== undefined) updateData.meetingTime = meetingTime;

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
    });

    // If there's feedback notes provided (e.g. from Sales marking it Closed_Lost), log it
    // And if there's an active meeting, update its status
    if (notes) {
      await prisma.callLog.create({
        data: {
          leadId: id,
          agentId: (session.user as any).id,
          callStatus: status || "Updated",
          notes: notes,
        }
      });

      // Synchronize back to the Meeting record if it's the Sales Agent providing resolution feedback
      const latestMeeting = await prisma.meeting.findFirst({
        where: { leadId: id },
        orderBy: { createdAt: "desc" }
      });

      if (latestMeeting && ["Closed_Won", "Closed_Lost", "Rescheduled"].includes(status)) {
        let mStatus = "Attended";
        if (status === "Closed_Won") mStatus = "Won";
        if (status === "Closed_Lost") mStatus = "Lost";
        if (status === "Rescheduled") mStatus = "Scheduled";

        await prisma.meeting.update({
          where: { id: latestMeeting.id },
          data: {
            status: mStatus,
            salesNotes: notes,
            ...(meetingDate ? { meetingDate: new Date(meetingDate + "T" + (meetingTime || "00:00") + ":00Z") } : {}),
            ...(meetingTime ? { meetingTime } : {})
          }
        });
      }
    }

    // Trigger Notification for Sales Reassignment
    if (assignedSalesAgentId) {
      await prisma.notification.create({
        data: {
          userId: assignedSalesAgentId,
          title: "New Lead Assigned",
          message: "A lead has been assigned to your queue.",
          link: "/dashboard/sales"
        }
      });
    }

    // Trigger Notification for Tele Agent Reassignment (Recycle)
    if (assignedTeleAgentId) {
      await prisma.notification.create({
        data: {
          userId: assignedTeleAgentId,
          title: "Recycled Lead Assigned",
          message: "A recycled lead has been assigned to you for follow-up.",
          link: "/dashboard/telesales"
        }
      });
    }

    return NextResponse.json({ success: true, lead });
  } catch (error: any) {
    console.error("Error updating lead:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || !["super_admin", "tele_sales_manager"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = params;

    await prisma.lead.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting lead:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
