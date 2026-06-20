import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeWebUrl } from "@/lib/safe-url";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { 
      status, notes, assignedSalesAgentId, assignedTeleAgentId, 
      followUpDate, meetingDate, meetingTime,
      meetingStartedAt, meetingEndedAt, hasStore, storeLink, customerType,
      archived, incrementRecycle
    } = body;

    const user = session.user as any;
    const existingLead = await prisma.lead.findUnique({
      where: { id },
      include: {
        teleAgent: { select: { directManagerId: true } },
        salesAgent: { select: { directManagerId: true } },
      },
    });
    if (!existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const isAuthorized = 
      existingLead.assignedTeleAgentId === user.id || 
      existingLead.assignedSalesAgentId === user.id ||
      user.role === "super_admin" ||
      (user.role === "tele_sales_manager" &&
        (!existingLead.assignedTeleAgentId || existingLead.teleAgent?.directManagerId === user.id)) ||
      (user.role === "sales_manager" &&
        (!existingLead.assignedSalesAgentId || existingLead.salesAgent?.directManagerId === user.id));

    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: You are not assigned to this lead." }, { status: 403 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (assignedSalesAgentId !== undefined) {
      if (!["super_admin", "sales_manager"].includes(user.role)) {
        return NextResponse.json({ error: "Only Sales Managers can reassign sales leads" }, { status: 403 });
      }
      if (assignedSalesAgentId) {
        const targetSalesAgent = await prisma.user.findUnique({
          where: { id: assignedSalesAgentId },
          select: { role: true, status: true, directManagerId: true },
        });
        if (
          !targetSalesAgent ||
          targetSalesAgent.role !== "sales_agent" ||
          targetSalesAgent.status !== "Active" ||
          (user.role === "sales_manager" && targetSalesAgent.directManagerId !== user.id)
        ) {
          return NextResponse.json({ error: "Invalid sales assignee" }, { status: 400 });
        }
      }
      updateData.assignedSalesAgentId = assignedSalesAgentId;
    }
    if (assignedTeleAgentId !== undefined) {
      if (!["super_admin", "tele_sales_manager"].includes(user.role)) {
        return NextResponse.json({ error: "Only TeleSales Managers can reassign TeleSales leads" }, { status: 403 });
      }
      if (assignedTeleAgentId) {
        const targetTeleAgent = await prisma.user.findUnique({
          where: { id: assignedTeleAgentId },
          select: { role: true, status: true, directManagerId: true },
        });
        if (
          !targetTeleAgent ||
          targetTeleAgent.role !== "tele_sales_agent" ||
          targetTeleAgent.status !== "Active" ||
          (user.role === "tele_sales_manager" && targetTeleAgent.directManagerId !== user.id)
        ) {
          return NextResponse.json({ error: "Invalid TeleSales assignee" }, { status: 400 });
        }
      }
      updateData.assignedTeleAgentId = assignedTeleAgentId;
    }
    if (followUpDate !== undefined) updateData.followUpDate = new Date(followUpDate);
    if (meetingDate !== undefined) updateData.meetingDate = new Date(meetingDate + "T00:00:00Z");
    if (meetingTime !== undefined) updateData.meetingTime = meetingTime;
    
    // New Sales Fields — allow explicit null to clear the timestamp (used when Start Task
    // begins a fresh task and we need to reset a previously-completed meeting window).
    if (meetingStartedAt !== undefined) {
      updateData.meetingStartedAt = meetingStartedAt === null ? null : new Date(meetingStartedAt);
    }
    if (meetingEndedAt !== undefined) {
      updateData.meetingEndedAt = meetingEndedAt === null ? null : new Date(meetingEndedAt);
    }
    if (hasStore !== undefined) updateData.hasStore = hasStore;
    if (storeLink !== undefined) {
      if (storeLink === null || storeLink === "") {
        updateData.storeLink = null;
      } else {
        const safeStoreLink = normalizeWebUrl(storeLink);
        if (!safeStoreLink) {
          return NextResponse.json({ error: "storeLink must be a valid http(s) URL" }, { status: 400 });
        }
        updateData.storeLink = safeStoreLink;
      }
    }
    if (customerType !== undefined) updateData.customerType = customerType;
    
    // Recycle Bin Fields
    if (archived) updateData.archivedAt = new Date();
    if (incrementRecycle) updateData.recycleCount = { increment: 1 };

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

      if (latestMeeting) {
        // Determine the new meeting status based on lead status change
        let mStatus: string | null = null;
        if (status === "Closed_Won") mStatus = "Won";
        else if (status === "Closed_Lost") mStatus = "Lost";
        else if (status === "Rescheduled") mStatus = "Scheduled";
        else if (status === "Follow_Up") mStatus = "Attended";
        else if (!status && latestMeeting.status === "Scheduled") {
          // Sales agent submitted feedback (notes) without changing lead status → meeting was attended
          mStatus = "Attended";
        }

        if (mStatus) {
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
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { teleAgent: { select: { directManagerId: true } } },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (
      user.role === "tele_sales_manager" &&
      lead.assignedTeleAgentId &&
      lead.teleAgent?.directManagerId !== user.id
    ) {
      return NextResponse.json({ error: "Forbidden: you can only delete leads assigned to your team" }, { status: 403 });
    }

    await prisma.lead.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting lead:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
