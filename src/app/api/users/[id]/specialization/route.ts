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
