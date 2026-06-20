import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recomputeMonth, loadCommissionConfig } from "@/lib/commissions";

const FINANCE_ROLES = ["super_admin", "accountant"];

/**
 * GET /api/finance/commissions?month=YYYY-MM — list all sales-agent commissions for a month.
 *   month defaults to the current month if omitted.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!user || !FINANCE_ROLES.includes(user.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const month = searchParams.get("month") || defaultMonth;

  try {
    const commissions = await prisma.commission.findMany({
      where: { month },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, level: true, hrRecord: { select: { monthlyTarget: true, baseSalary: true } } },
        },
      },
      orderBy: { netPayout: "desc" },
    });
    const config = await loadCommissionConfig();
    return NextResponse.json({ commissions, month, config });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Finance commissions GET error:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/finance/commissions — recompute commissions for a month.
 * Body: { month: "YYYY-MM" }
 * Skips finalized rows.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!user || !FINANCE_ROLES.includes(user.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { month } = body || {};
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  try {
    const results = await recomputeMonth(month);
    return NextResponse.json({ success: true, count: results.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Finance commissions POST error:", msg);
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}
