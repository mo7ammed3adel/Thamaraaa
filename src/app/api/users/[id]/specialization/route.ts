import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || !["super_admin", "tele_sales_manager", "sales_manager", "chief_sales"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { specialization } = await request.json();

    if (!["Hot", "Cold", "Warm", null].includes(specialization)) {
      return NextResponse.json({ error: "Invalid specialization" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true, directManagerId: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const canUpdate =
      user.role === "super_admin" ||
      user.role === "chief_sales" ||
      (user.role === "tele_sales_manager" &&
        targetUser.role === "tele_sales_agent" &&
        targetUser.directManagerId === user.id) ||
      (user.role === "sales_manager" &&
        targetUser.role === "sales_agent" &&
        targetUser.directManagerId === user.id);

    if (!canUpdate) {
      return NextResponse.json({ error: "Forbidden: you cannot update this user's specialization" }, { status: 403 });
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { specialization },
      select: { id: true, name: true, specialization: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
