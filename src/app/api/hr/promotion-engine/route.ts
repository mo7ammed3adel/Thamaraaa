import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateAllEmployees } from "@/lib/promotion";

const HR_ROLES = ["super_admin", "hr_manager"];

/**
 * GET /api/hr/promotion-engine — list all employees with their evaluation
 * Returns: { evaluations: PromotionEvaluation[] }
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!user || !HR_ROLES.includes(user.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const evaluations = await evaluateAllEmployees();
    return NextResponse.json({ evaluations });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Promotion engine GET error:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/hr/promotion-engine — execute an HR action against an employee.
 * Body: { userId: string, action: "promote" | "warn" | "terminate" | "clear", nextLevel?, nextRole? }
 *
 *  - promote   → updates User.level (and User.role if nextRole supplied) + clears promotionEligible flag
 *  - warn      → increments HrRecord.warningCount; sets terminationFlag if count ≥ 3; creates Notification
 *  - terminate → sets HrRecord.terminationFlag and User.status = "Inactive"
 *  - clear     → resets warningCount=0 and terminationFlag=false
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; role: string; name?: string } | undefined;
  if (!actor || !HR_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, action, nextLevel, nextRole } = body || {};
  if (!userId || !action) {
    return NextResponse.json({ error: "userId and action are required" }, { status: 400 });
  }

  const validActions = ["promote", "warn", "terminate", "clear"] as const;
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  }

  try {
    const hr = await prisma.hrRecord.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, role: true, level: true } } },
    });
    if (!hr) {
      return NextResponse.json({ error: "Employee has no HR record" }, { status: 404 });
    }

    if (action === "promote") {
      const userUpdate: { level?: string; role?: string } = {};
      if (nextLevel) userUpdate.level = nextLevel;
      if (nextRole) userUpdate.role = nextRole;
      if (Object.keys(userUpdate).length === 0) {
        return NextResponse.json({ error: "nextLevel or nextRole required for promote" }, { status: 400 });
      }

      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: userUpdate }),
        prisma.hrRecord.update({ where: { userId }, data: { promotionEligible: false, level: nextLevel || hr.level } }),
        prisma.notification.create({
          data: {
            userId,
            title: "Promotion",
            message: `Congratulations! You have been promoted${nextLevel ? ` to ${nextLevel}` : ""}${nextRole ? ` (${nextRole.replace(/_/g, " ")})` : ""}.`,
            type: "promotion",
          },
        }),
      ]);

      return NextResponse.json({ success: true, action, userId });
    }

    if (action === "warn") {
      const newCount = hr.warningCount + 1;
      const terminationFlag = newCount >= 3;
      await prisma.$transaction([
        prisma.hrRecord.update({
          where: { userId },
          data: { warningCount: newCount, terminationFlag },
        }),
        prisma.notification.create({
          data: {
            userId,
            title: "Performance Warning",
            message: `You have received a performance warning (count: ${newCount}). Please discuss with HR.`,
            type: "hr_warning",
          },
        }),
      ]);
      return NextResponse.json({ success: true, action, userId, warningCount: newCount, terminationFlag });
    }

    if (action === "terminate") {
      await prisma.$transaction([
        prisma.hrRecord.update({ where: { userId }, data: { terminationFlag: true } }),
        prisma.user.update({ where: { id: userId }, data: { status: "Inactive" } }),
        prisma.notification.create({
          data: {
            userId,
            title: "Account Inactive",
            message: "Your account has been marked inactive. Contact HR for details.",
            type: "hr_termination",
          },
        }),
      ]);
      return NextResponse.json({ success: true, action, userId });
    }

    if (action === "clear") {
      await prisma.hrRecord.update({
        where: { userId },
        data: { warningCount: 0, terminationFlag: false, promotionEligible: false },
      });
      return NextResponse.json({ success: true, action, userId });
    }

    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Promotion engine POST error:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
