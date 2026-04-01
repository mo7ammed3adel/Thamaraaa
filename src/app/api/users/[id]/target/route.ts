import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    // Only allow managers or super admins
    if (!session || !["super_admin", "tele_sales_manager"].includes(userRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { target, month } = await request.json();

    if (typeof target !== "number") {
      return NextResponse.json({ error: "Invalid target value" }, { status: 400 });
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
