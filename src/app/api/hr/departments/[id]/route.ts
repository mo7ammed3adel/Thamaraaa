export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { prisma } from "@/lib/prisma";

const HR_ROLES = ["super_admin", "hr_manager"];

async function requireHr() {
  const user = await getSessionUser();
  if (!user) return { error: unauthorizedJson() };
  if (!HR_ROLES.includes(user.role || "")) return { error: errorJson("Forbidden", 403) };
  return { user };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireHr();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return errorJson("Invalid body", 400);

  const data: any = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return errorJson("Department name is required", 400);
    const conflict = await prisma.hrDepartment.findFirst({ where: { name, NOT: { id: params.id } } });
    if (conflict) return errorJson("A department with this name already exists", 400);
    data.name = name;
  }
  if (body.description !== undefined) data.description = body.description || null;
  if (body.status !== undefined) data.status = body.status === "inactive" ? "inactive" : "active";
  if (body.headId !== undefined) data.headId = body.headId || null;
  if (body.teamLeaderIds !== undefined) data.teamLeaderIds = JSON.stringify(Array.isArray(body.teamLeaderIds) ? body.teamLeaderIds : []);
  if (body.policy !== undefined) data.policy = JSON.stringify(body.policy && typeof body.policy === "object" ? body.policy : {});

  try {
    const department = await prisma.hrDepartment.update({ where: { id: params.id }, data });
    return successJson({ department });
  } catch (e: unknown) {
    console.error("Department PATCH error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireHr();
  if (error) return error;

  try {
    const dept = await prisma.hrDepartment.findUnique({ where: { id: params.id } });
    if (!dept) return errorJson("Department not found", 404);
    const inUse = await prisma.hrRecord.count({ where: { department: dept.name } });
    if (inUse > 0) {
      return errorJson(`Cannot delete: ${inUse} employee(s) are still assigned to this department.`, 400);
    }
    await prisma.hrDepartment.delete({ where: { id: params.id } });
    return successJson({ success: true });
  } catch (e: unknown) {
    console.error("Department DELETE error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
