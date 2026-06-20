import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    
    // Check permission
    if (!user || (user.role !== "tele_sales_agent" && user.role !== "super_admin" && user.role !== "tele_sales_manager")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { leadIds } = await req.json();
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
       return NextResponse.json({ error: "No leads selected" }, { status: 400 });
    }

    // Protection against Duplicates
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

    const draftLeads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, status: "Draft", ...draftScope },
      select: { id: true, phone: true }
    });

    const draftPhones = draftLeads.map(l => l.phone);

    // Identify which drafted phones already exist as active/closed leads
    const existingDuplicates = await prisma.lead.findMany({
      where: {
        phone: { in: draftPhones },
        status: { not: "Draft" }
      },
      select: { phone: true }
    });

    const duplicatePhones = existingDuplicates.map(l => l.phone);

    // Filter duplicates
    const validLeadIdsToPromote = draftLeads
      .filter(l => !duplicatePhones.includes(l.phone))
      .map(l => l.id);

    if (validLeadIdsToPromote.length > 0) {
      await prisma.lead.updateMany({
        where: { id: { in: validLeadIdsToPromote } },
        data: {
          status: "New",
          assignedTeleAgentId: user.id
        }
      });
    }

    if (duplicatePhones.length > 0 && validLeadIdsToPromote.length === 0) {
       return NextResponse.json({ error: "Promotion failed: All selected leads are already active inside the system." }, { status: 400 });
    }

    let message = `Successfully promoted ${validLeadIdsToPromote.length} to Active Leads!`;
    if (duplicatePhones.length > 0) {
      message += ` (Skipped ${duplicatePhones.length} because their phone number already exists)`;
    }

    return NextResponse.json({ promotedCount: validLeadIdsToPromote.length, message }, { status: 200 });

  } catch (error) {
    console.error("Bulk promote error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
