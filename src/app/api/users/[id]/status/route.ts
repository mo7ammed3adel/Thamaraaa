import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    // Only allow managers, super admins, or the user themselves to update status
    if (!session || (!["super_admin", "sales_manager", "tele_sales_manager"].includes(userRole) && (session.user as any).id !== params.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { status } = await request.json();

    if (!["Active", "Busy", "In_Call"].includes(status)) {
      return NextResponse.json({ error: "Invalid status format" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { status },
      select: { id: true, name: true, status: true },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Failed to update status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
