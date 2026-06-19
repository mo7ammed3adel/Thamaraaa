import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const userId = (session.user as any).id;

    const { action } = await req.json(); // "checkIn" or "checkOut"
    
    // Find today's record
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let record = await prisma.attendance.findFirst({
      where: {
        userId,
        date: {
          gte: today,
        }
      }
    });

    if (action === "checkIn") {
      if (record) return NextResponse.json({ error: "Already checked in today" }, { status: 400 });
      
      const checkInTime = new Date();
      // Calculate delay based on 9 AM shift start (example standard)
      const shiftStart = new Date();
      shiftStart.setHours(9, 0, 0, 0);
      
      const lateMinutes = Math.max(0, Math.floor((checkInTime.getTime() - shiftStart.getTime()) / 60000));

      // Draft a deduction for lateness beyond a 15-minute grace window.
      // HR must approve before it ever affects payroll (see PATCH below).
      const GRACE_MINUTES = 15;
      const PER_MINUTE_FEE = 1; // SAR per late minute past the grace window
      const deductionDraft = lateMinutes > GRACE_MINUTES
        ? Math.round((lateMinutes - GRACE_MINUTES) * PER_MINUTE_FEE)
        : null;

      record = await prisma.attendance.create({
        data: {
          userId,
          date: new Date(),
          checkIn: checkInTime,
          lateMinutes,
          deductionDraft,
        }
      });
      return NextResponse.json(record, { status: 201 });
    }
    else if (action === "checkOut") {
      if (!record || record.checkOut) {
        return NextResponse.json({ error: "No active check-in or already checked out" }, { status: 400 });
      }
      record = await prisma.attendance.update({
        where: { id: record.id },
        data: { checkOut: new Date() }
      });
      return NextResponse.json(record, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
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
    if (!id || !action) {
      return NextResponse.json({ error: "id and action are required" }, { status: 400 });
    }

    let data: any = {};
    if (action === "approve") {
      data = { deductionApproved: true };
      if (deductionDraft !== undefined) data.deductionDraft = Number(deductionDraft) || 0;
    } else if (action === "reject") {
      data = { deductionApproved: false, deductionDraft: null };
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const record = await prisma.attendance.update({ where: { id }, data });
    return NextResponse.json(record, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
