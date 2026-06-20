import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { sumLineItems } from "@/lib/commissions";

const FINANCE_ROLES = ["super_admin", "accountant"];

/**
 * GET /api/finance/commissions/export?month=YYYY-MM
 * Streams an .xlsx with one row per agent.
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

  const commissions = await prisma.commission.findMany({
    where: { month },
    include: {
      user: {
        select: { name: true, email: true, role: true, level: true, hrRecord: { select: { monthlyTarget: true, baseSalary: true } } },
      },
    },
    orderBy: { netPayout: "desc" },
  });

  const rows = commissions.map((c: any) => ({
    Employee: c.user.name,
    Email: c.user.email,
    Role: c.user.role,
    Level: c.user.level || "",
    "Base Salary (SAR)": c.user.hrRecord?.baseSalary || 0,
    "Monthly Target (SAR)": c.user.hrRecord?.monthlyTarget || 0,
    "Net Target Achieved (SAR)": c.netTarget,
    "Achievement %":
      c.user.hrRecord?.monthlyTarget > 0 ? Math.round((c.netTarget / c.user.hrRecord.monthlyTarget) * 100) : 0,
    "Commission %": Math.round(c.commissionPct * 10000) / 100,
    "Commission Amount (SAR)": c.commissionAmount,
    "Bonuses (SAR)": sumLineItems(c.bonuses),
    "Deductions (SAR)": sumLineItems(c.deductions),
    "Net Payout (SAR)": c.netPayout,
    Finalized: c.finalized ? "Yes" : "No",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, `Commissions ${month}`);

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  // The DOM lib's BodyInit doesn't strictly recognise Node Buffer, but at runtime
  // Buffer extends Uint8Array and is a valid stream input. Casting via unknown silences
  // the TS lib mismatch without changing runtime behaviour.
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="commissions-${month}.xlsx"`,
    },
  });
}
