export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { editDepartment, removeDepartment } from "@/server/services/hrService";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const body = await req.json().catch(() => null);

  try {
    const result = await editDepartment({ user, id: params.id, body });
    if (result.status === "forbidden") return errorJson("Forbidden", 403);
    if (result.status === "invalid_body") return errorJson("Invalid body", 400);
    if (result.status === "missing_name") return errorJson("Department name is required", 400);
    if (result.status === "duplicate_name") {
      return errorJson("A department with this name already exists", 400);
    }
    return successJson({ department: result.department });
  } catch (e: unknown) {
    console.error("Department PATCH error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  try {
    const result = await removeDepartment({ user, id: params.id });
    if (result.status === "forbidden") return errorJson("Forbidden", 403);
    if (result.status === "not_found") return errorJson("Department not found", 404);
    if (result.status === "in_use") {
      return errorJson(`Cannot delete: ${result.inUse} employee(s) are still assigned to this department.`, 400);
    }
    return successJson({ success: true });
  } catch (e: unknown) {
    console.error("Department DELETE error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
