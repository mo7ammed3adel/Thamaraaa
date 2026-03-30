import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  
  if (!["super_admin", "hr_manager"].includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const records = await prisma.hrRecord.findMany({
      include: { user: true }
    });

    let promotions = 0;
    let warnings = 0;

    for (const record of records) {
      let history: { month: string, hitTarget: boolean }[] = [];
      try {
        history = JSON.parse(record.performanceHistory || "[]");
      } catch (e) {
        continue;
      }

      if (history.length < 3) continue;

      // Get the last 3 months
      const last3 = history.slice(-3);
      
      const consecutiveHits = last3.every(h => h.hitTarget === true);
      const consecutiveMisses = last3.every(h => h.hitTarget === false);

      const updates: any = {};

      if (consecutiveHits && !record.promotionEligible) {
        updates.promotionEligible = true;
        promotions++;
      } else if (consecutiveMisses) {
        // Only increment warning if we haven't already warned for this exact period.
        // For simplicity in this CRM, we'll increment the warning count and set termination flag if > 2
        updates.warningCount = record.warningCount + 1;
        if (updates.warningCount >= 3) {
          updates.terminationFlag = true;
        }
        warnings++;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.hrRecord.update({
          where: { id: record.id },
          data: updates
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Evaluation complete. ${promotions} new promotions eligible, ${warnings} new warnings issued.`
    });
  } catch (error: any) {
    console.error("Evaluation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
