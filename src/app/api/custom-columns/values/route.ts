import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["super_admin", "tele_sales_manager", "tele_sales_agent"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { columnId, leadId, value } = await req.json();

    if (!columnId || !leadId) {
      return NextResponse.json({ error: "columnId and leadId are required" }, { status: 400 });
    }

    if (user.role === "tele_sales_agent") {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { assignedTeleAgentId: true },
      });
      if (!lead || lead.assignedTeleAgentId !== user.id) {
        return NextResponse.json({ error: "Forbidden: you cannot edit this lead" }, { status: 403 });
      }
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
