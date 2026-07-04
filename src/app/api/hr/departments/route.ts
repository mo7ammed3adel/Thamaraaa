export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { createDepartment, listHrDepartments } from "@/server/services/hrService";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  try {
    const result = await listHrDepartments(user);
    if (result.status === "forbidden") return errorJson("Forbidden", 403);
    return successJson({ departments: result.departments });
  } catch (e: unknown) {
    console.error("Departments GET error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const body = await req.json().catch(() => null);

  try {
    const result = await createDepartment({ user, body });
    if (result.status === "forbidden") return errorJson("Forbidden", 403);
    if (result.status === "missing_name") return errorJson("Department name is required", 400);
    if (result.status === "duplicate_name") {
      return errorJson("A department with this name already exists", 400);
    }
    return successJson({ department: result.department }, 201);
  } catch (e: unknown) {
    console.error("Departments POST error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
