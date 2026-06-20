import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sumLineItems } from "@/lib/commissions";

const FINANCE_ROLES = ["super_admin", "accountant"];

/**
 * PATCH /api/finance/commissions/[id]
 * Body: {
 *   bonuses?: BonusItem[],
 *   deductions?: DeductionItem[],
 *   finalized?: boolean
 * }
 *
 * - bonuses/deductions persist as JSON strings.
 * - netPayout is auto-recomputed from baseSalary + commissionAmount + bonuses − deductions.
 * - finalized commissions can be set finalized=true once and cannot be unfinalized
 *   (matches the spec's payout-once intent).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

  const existing = await prisma.commission.findUnique({
    where: { id: params.id },
    include: { user: { include: { hrRecord: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Commission not found" }, { status: 404 });

  if (existing.finalized && (body.bonuses !== undefined || body.deductions !== undefined)) {
    return NextResponse.json({ error: "Finalized commission cannot be edited" }, { status: 409 });
  }

  const data: any = {};
  if (Array.isArray(body.bonuses)) data.bonuses = JSON.stringify(body.bonuses);
  if (Array.isArray(body.deductions)) data.deductions = JSON.stringify(body.deductions);
  if (body.finalized === true) data.finalized = true;

  // Recompute netPayout if bonuses/deductions changed.
  if (data.bonuses !== undefined || data.deductions !== undefined) {
    const baseSalary = existing.user.hrRecord?.baseSalary || 0;
    const bonusesSum = sumLineItems(data.bonuses ?? existing.bonuses);
    const deductionsSum = sumLineItems(data.deductions ?? existing.deductions);
    data.netPayout = Math.round((baseSalary + existing.commissionAmount + bonusesSum - deductionsSum) * 100) / 100;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
  }

  try {
    const updated = await prisma.commission.update({ where: { id: params.id }, data });
    return NextResponse.json({ success: true, commission: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Commission PATCH error:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
