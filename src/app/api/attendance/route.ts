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
      
      record = await prisma.attendance.create({
        data: {
          userId,
          date: new Date(),
          checkIn: checkInTime,
          lateMinutes
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
