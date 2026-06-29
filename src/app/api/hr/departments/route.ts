export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { prisma } from "@/lib/prisma";

const HR_ROLES = ["super_admin", "hr_manager"];

function parse(json: string | null | undefined, fallback: any) {
  if (!json) return fallback;
  try { return JSON.parse(json); } catch { return fallback; }
}

async function requireHr() {
  const user = await getSessionUser();
  if (!user) return { error: unauthorizedJson() };
  if (!HR_ROLES.includes(user.role || "")) return { error: errorJson("Forbidden", 403) };
  return { user };
}

export async function GET() {
  const { error } = await requireHr();
  if (error) return error;

  try {
    const [departments, hrRecords] = await Promise.all([
      prisma.hrDepartment.findMany({ include: { documents: { orderBy: { createdAt: "desc" } } }, orderBy: { name: "asc" } }),
      prisma.hrRecord.findMany({ select: { department: true } }),
    ]);
    const counts = new Map<string, number>();
    for (const r of hrRecords) {
      if (r.department) counts.set(r.department, (counts.get(r.department) || 0) + 1);
    }
    return successJson({
      departments: departments.map((d) => ({
        ...d,
        teamLeaderIds: parse(d.teamLeaderIds, []),
        policy: parse(d.policy, {}),
        employeeCount: counts.get(d.name) || 0,
      })),
    });
  } catch (e: unknown) {
    console.error("Departments GET error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireHr();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return errorJson("Department name is required", 400);

  try {
    const existing = await prisma.hrDepartment.findUnique({ where: { name } });
    if (existing) return errorJson("A department with this name already exists", 400);
    const department = await prisma.hrDepartment.create({
      data: {
        name,
        description: body.description || null,
        status: body.status === "inactive" ? "inactive" : "active",
        headId: body.headId || null,
        teamLeaderIds: JSON.stringify(Array.isArray(body.teamLeaderIds) ? body.teamLeaderIds : []),
        policy: JSON.stringify(body.policy && typeof body.policy === "object" ? body.policy : {}),
      },
    });
    return successJson({ department }, 201);
  } catch (e: unknown) {
    console.error("Departments POST error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
