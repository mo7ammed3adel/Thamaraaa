import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recomputeMonth, recomputeTelesalesBonuses } from "@/lib/commissions";
import { pusherServer } from "@/lib/pusher";

// Config keys that affect payroll/commission math. Changing any of them triggers
// an immediate recompute of the current month so the new values apply live.
const FINANCE_KEYS = new Set(["telesales_bonus_rules", "commission_tiers", "gateway_fee_pct"]);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const adminId = (session?.user as any)?.id;
    if ((session?.user as any)?.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { key, value } = await req.json();

    if (typeof key !== "string" || !key.trim() || typeof value !== "string") {
      return NextResponse.json({ error: "key and value (string) are required" }, { status: 400 });
    }

    // Validate JSON-shaped finance keys before saving so we never persist garbage
    // that would later break a recompute.
    if (key === "telesales_bonus_rules" || key === "commission_tiers") {
      try {
        const parsed = JSON.parse(value);
        if (key === "commission_tiers" && !Array.isArray(parsed)) {
          return NextResponse.json({ error: "commission_tiers must be a JSON array" }, { status: 400 });
        }
        if (key === "telesales_bonus_rules" && (typeof parsed !== "object" || parsed === null)) {
          return NextResponse.json({ error: "telesales_bonus_rules must be a JSON object" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: `${key} must be valid JSON` }, { status: 400 });
      }
    }
    if (key === "gateway_fee_pct") {
      const fee = parseFloat(value);
      if (isNaN(fee) || fee < 0 || fee >= 1) {
        return NextResponse.json({ error: "gateway_fee_pct must be a decimal between 0 and 1" }, { status: 400 });
      }
    }

    const config = await prisma.systemConfig.upsert({
      where: { key },
      update: { value, updatedById: adminId },
      create: { key, value, updatedById: adminId }
    });

    // Live-apply: recompute the current month so the change is reflected immediately
    // in Finance and My Profile, and notify any open finance dashboard to refresh.
    let recomputed = false;
    if (FINANCE_KEYS.has(key)) {
      const month = new Date().toISOString().slice(0, 7);
      try {
        await Promise.all([recomputeMonth(month), recomputeTelesalesBonuses(month)]);
        recomputed = true;
        if (pusherServer) {
          await pusherServer.trigger("finance-channel", "config-updated", { key, month });
        }
      } catch (e) {
        console.error("Live recompute after config change failed:", e);
      }
    }

    return NextResponse.json({ ...config, recomputed }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
