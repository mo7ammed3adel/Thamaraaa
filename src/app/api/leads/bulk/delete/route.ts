import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    
    if (!user || (user.role !== "tele_sales_agent" && user.role !== "super_admin" && user.role !== "tele_sales_manager")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { leadIds } = await req.json();
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
       return NextResponse.json({ error: "No leads selected" }, { status: 400 });
    }

    const draftScope: any =
      user.role === "tele_sales_agent"
        ? { OR: [{ createdById: user.id }, { assignedTeleAgentId: user.id }] }
        : user.role === "tele_sales_manager"
          ? {
              OR: [
                { createdById: user.id },
                { assignedTeleAgentId: null },
                { teleAgent: { is: { directManagerId: user.id } } },
              ],
            }
          : {};

    // Only allow deletion of Draft leads
    const result = await prisma.lead.deleteMany({
      where: {
        id: { in: leadIds },
        status: "Draft",
        ...draftScope,
      }
    });

    return NextResponse.json({ deletedCount: result.count }, { status: 200 });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
