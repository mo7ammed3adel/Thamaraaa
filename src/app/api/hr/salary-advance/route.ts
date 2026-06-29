export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { prisma } from "@/lib/prisma";

const HR_ROLES = ["super_admin", "hr_manager", "accountant"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  const isHr = HR_ROLES.includes(user.role || "");

  try {
    const advances = await prisma.salaryAdvance.findMany({
      where: isHr ? {} : { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    const names = new Map(
      (await prisma.user.findMany({ where: { id: { in: advances.map((a) => a.userId) } }, select: { id: true, name: true } }))
        .map((u) => [u.id, u.name])
    );
    return successJson({ advances: advances.map((a) => ({ ...a, employeeName: names.get(a.userId) || "Unknown" })) });
  } catch (e: unknown) {
    console.error("Salary advance GET error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!amount || amount <= 0 || !reason) return errorJson("A valid amount and reason are required", 400);

  try {
    const advance = await prisma.salaryAdvance.create({
      data: { userId: user.id, amount, reason, status: "pending_dept_head" },
    });
    const hr = await prisma.user.findFirst({ where: { role: "hr_manager", status: "Active" }, select: { id: true } });
    if (hr) {
      await prisma.notification.create({
        data: { userId: hr.id, title: "New Salary Advance Request", message: `${user.name} requested a salary advance of ${amount} SAR.`, link: "/dashboard/hr" },
      });
    }
    return successJson({ advance }, 201);
  } catch (e: unknown) {
    console.error("Salary advance POST error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
