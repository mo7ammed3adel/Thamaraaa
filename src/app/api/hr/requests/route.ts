export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const { type, date, duration, reason } = await req.json();

    const requestOut = await prisma.leaveRequest.create({
      data: {
        userId: user.id,
        type,
        date: new Date(date),
        duration,
        reason,
        status: "Pending"
      }
    });

    // Notify HR manager
    const hr = await prisma.user.findFirst({ where: { role: "hr_manager" } });
    if (hr) {
      await prisma.notification.create({
        data: {
          userId: hr.id,
          title: `New ${type} Request`,
          message: `${user.name} has requested a ${type} for ${date}`,
          link: `/dashboard/hr/requests`
        }
      });
    }

    return NextResponse.json(requestOut, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    let requests;

    // HR sees all pending, User sees only their own
    if (user.role === "hr_manager" || user.role === "super_admin") {
      requests = await prisma.leaveRequest.findMany({
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      requests = await prisma.leaveRequest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
      });
    }

    return NextResponse.json(requests);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
