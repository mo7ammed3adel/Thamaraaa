import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const actor = session?.user as any;
    const userRole = actor?.role;

    if (!session || !actor?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { status } = await request.json();

    if (!["Active", "Busy", "In_Call"].includes(status)) {
      return NextResponse.json({ error: "Invalid status format" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true, directManagerId: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isSelf = actor.id === params.id;
    const isSuper = userRole === "super_admin";
    const isDirectSalesManager =
      userRole === "sales_manager" &&
      targetUser.role === "sales_agent" &&
      targetUser.directManagerId === actor.id;
    const isDirectTeleSalesManager =
      userRole === "tele_sales_manager" &&
      targetUser.role === "tele_sales_agent" &&
      targetUser.directManagerId === actor.id;

    if (!isSelf && !isSuper && !isDirectSalesManager && !isDirectTeleSalesManager) {
      return NextResponse.json({ error: "Forbidden: you cannot update this user's status" }, { status: 403 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { status, lastStatusChange: new Date() },
      select: { id: true, name: true, status: true, lastStatusChange: true },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Failed to update status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
