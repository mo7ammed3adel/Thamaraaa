import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "hr_manager" && session.user?.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const employees = await prisma.user.findMany({
      include: {
        hrRecord: true,
        attendances: {
          take: 5,
          orderBy: { date: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ employees });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
