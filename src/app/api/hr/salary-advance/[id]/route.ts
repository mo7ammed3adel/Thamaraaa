export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { prisma } from "@/lib/prisma";

const HR_ROLES = ["super_admin", "hr_manager", "accountant"];

// Workflow: pending_dept_head → approve → pending_accountant → approve → approved → markPaid → paid (or reject)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  if (!HR_ROLES.includes(user.role || "")) return errorJson("Forbidden", 403);

  const body = await req.json().catch(() => null);
  const action = body?.action;

  try {
    const current = await prisma.salaryAdvance.findUnique({ where: { id: params.id } });
    if (!current) return errorJson("Request not found", 404);

    const data: any = {};
    if (action === "approve") {
      if (current.status === "pending_dept_head") { data.status = "pending_accountant"; data.deptHeadApprovedById = user.id; data.deptHeadApprovedAt = new Date(); }
      else if (current.status === "pending_accountant") { data.status = "approved"; data.accountantApprovedById = user.id; data.accountantApprovedAt = new Date(); }
      else return errorJson("Request cannot be approved from its current state", 400);
    } else if (action === "reject") {
      data.status = "rejected";
      data.rejectionReason = typeof body?.reason === "string" ? body.reason : null;
    } else if (action === "markPaid") {
      if (current.status !== "approved") return errorJson("Only approved requests can be marked paid", 400);
      data.status = "paid";
      data.paidAt = new Date();
    } else {
      return errorJson("Invalid action", 400);
    }

    const advance = await prisma.salaryAdvance.update({ where: { id: params.id }, data });
    await prisma.notification.create({
      data: { userId: current.userId, title: "Salary Advance Update", message: `Your salary advance request is now: ${advance.status.replace(/_/g, " ")}.`, link: "/dashboard/hr" },
    });
    return successJson({ advance });
  } catch (e: unknown) {
    console.error("Salary advance PATCH error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
