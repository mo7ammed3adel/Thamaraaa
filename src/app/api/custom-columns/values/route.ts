import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { columnId, leadId, value } = await req.json();

    if (!columnId || !leadId) {
      return NextResponse.json({ error: "columnId and leadId are required" }, { status: 400 });
    }

    const result = await prisma.customColumnValue.upsert({
      where: {
        columnId_leadId: { columnId, leadId },
      },
      update: { value: value || "" },
      create: { columnId, leadId, value: value || "" },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
