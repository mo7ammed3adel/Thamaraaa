import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    
    if (!user || (user.role !== "hr_manager" && user.role !== "super_admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const { status, feedbackNotes } = await req.json();

    const leaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: { status, feedbackNotes }
    });

    // Notify the user about the decision
    await prisma.notification.create({
      data: {
        userId: leaveRequest.userId,
        title: `Request ${status}`,
        message: `Your ${leaveRequest.type} request for ${leaveRequest.date.toLocaleDateString()} has been ${status}.`,
        link: `/dashboard/profile`
      }
    });

    return NextResponse.json(leaveRequest);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
