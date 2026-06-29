export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { prisma } from "@/lib/prisma";

async function requireSuperAdmin() {
  const user = await getSessionUser();
  if (!user) return { error: unauthorizedJson() };
  if (user.role !== "super_admin") return { error: errorJson("Forbidden", 403) };
  return { user };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return errorJson("Company name is required", 400);

  try {
    const conflict = await prisma.company.findFirst({ where: { name, NOT: { id: params.id } } });
    if (conflict) return errorJson("A company with this name already exists", 400);
    const company = await prisma.company.update({ where: { id: params.id }, data: { name } });
    return successJson({ company });
  } catch (e: unknown) {
    console.error("Company PATCH error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const [userCount, leadCount] = await Promise.all([
      prisma.user.count({ where: { companyId: params.id } }),
      prisma.lead.count({ where: { companyId: params.id } }),
    ]);
    if (userCount > 0 || leadCount > 0) {
      return errorJson(
        `Cannot delete: ${userCount} user(s) and ${leadCount} lead(s) are still linked to this company.`,
        400
      );
    }
    await prisma.company.delete({ where: { id: params.id } });
    return successJson({ success: true });
  } catch (e: unknown) {
    console.error("Company DELETE error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
