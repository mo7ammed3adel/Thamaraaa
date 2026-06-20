import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const actor = session?.user as any;
    const userRole = actor?.role;

    // Only allow managers or super admins
    if (!session || !["super_admin", "tele_sales_manager"].includes(userRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { target, month } = await request.json();

    if (typeof target !== "number") {
      return NextResponse.json({ error: "Invalid target value" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true, directManagerId: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (
      userRole === "tele_sales_manager" &&
      (targetUser.role !== "tele_sales_agent" || targetUser.directManagerId !== actor.id)
    ) {
      return NextResponse.json({ error: "Forbidden: you can only set targets for your direct TeleSales agents" }, { status: 403 });
    }
     
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // Upsert the target
    const updatedTarget = await prisma.agentTarget.upsert({
      where: {
        agentId_month: {
          agentId: params.id,
          month: targetMonth,
        }
      },
      update: {
        target: target
      },
      create: {
        agentId: params.id,
        month: targetMonth,
        target: target
      }
    });

    return NextResponse.json(updatedTarget);
  } catch (error) {
    console.error("Failed to update target:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
