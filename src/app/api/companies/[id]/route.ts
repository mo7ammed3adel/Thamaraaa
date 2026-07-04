export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { removeCompany, renameCompany } from "@/server/services/referenceDataService";

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
    const result = await renameCompany({ id: params.id, name });
    if (result.status === "duplicate_name") {
      return errorJson("A company with this name already exists", 400);
    }
    return successJson({ company: result.company });
  } catch (e: unknown) {
    console.error("Company PATCH error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const result = await removeCompany(params.id);
    if (result.status === "in_use") {
      return errorJson(
        `Cannot delete: ${result.userCount} user(s) and ${result.leadCount} lead(s) are still linked to this company.`,
        400
      );
    }
    return successJson({ success: true });
  } catch (e: unknown) {
    console.error("Company DELETE error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
