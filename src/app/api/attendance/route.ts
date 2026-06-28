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
      const shiftStart = new Date();
      shiftStart.setHours(9, 0, 0, 0);
      
      const lateMinutes = Math.max(0, Math.floor((checkInTime.getTime() - shiftStart.getTime()) / 60000));
      const deductionHours = lateDeductionHours(lateMinutes);
      const deductionDraft = await draftAttendanceDeduction(userId, deductionHours);

      record = await prisma.attendance.create({
        data: {
          userId,
          date: new Date(),
          checkIn: checkInTime,
          lateMinutes,
          deductionHours,
          deductionDraft,
          status: lateMinutes > 18 ? "late" : "on_time",
        }
      });
      return NextResponse.json(record, { status: 201 });
    }
    else if (action === "checkOut") {
      if (!record || record.checkOut) {
        return NextResponse.json({ error: "No active check-in or already checked out" }, { status: 400 });
      }
      const checkOut = new Date();
      const shiftEnd = new Date();
      shiftEnd.setHours(17, 0, 0, 0);
      const earlyLeaveMinutes = Math.max(0, Math.floor((shiftEnd.getTime() - checkOut.getTime()) / 60000));
      const earlyHours = earlyLeaveMinutes >= 60 ? 4 : 0;
      const deductionHours = (record.deductionHours || 0) + earlyHours;
      const deductionDraft = await draftAttendanceDeduction(userId, deductionHours);

      record = await prisma.attendance.update({
        where: { id: record.id },
        data: {
          checkOut,
          earlyLeaveMinutes,
          deductionHours,
          deductionDraft,
          status: earlyHours > 0 ? "early_leave" : record.status,
        }
      });
      return NextResponse.json(record, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function lateDeductionHours(lateMinutes: number) {
  if (lateMinutes <= 18) return 0;
  if (lateMinutes <= 35) return 2;
  if (lateMinutes <= 90) return 4;
  return 6;
}

async function draftAttendanceDeduction(userId: string, deductionHours: number) {
  if (deductionHours <= 0) return null;
  const hr = await prisma.hrRecord.findUnique({ where: { userId } });
  const baseSalary = hr?.currentSalary || hr?.baseSalary || 0;
  const workingHours = hr?.workingHoursPerDay || 8;
  const hourlyRate = baseSalary > 0 ? baseSalary / 26 / workingHours : 0;
  return Math.round(hourlyRate * deductionHours * 100) / 100;
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
