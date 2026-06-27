import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { createEmployee, listEmployees, updateEmployee } from "@/server/services/hrService";

function isHrManager(role?: string | null) {
  return role === "hr_manager" || role === "super_admin";
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!isHrManager(user?.role)) {
    return errorJson("Unauthorized", 401);
  }

  try {
    return successJson({ employees: await listEmployees() });
  } catch (error) {
    return errorJson("Server error", 500);
  }
}

/**
 * POST /api/hr/employees
 * Creates a full employee: a User row plus the linked HrRecord that holds
 * the financial/performance fields (baseSalary, monthlyTarget, level).
 */
export async function POST(req: Request) {
  const actor = await getSessionUser();

  try {
    const result = await createEmployee({
      actorRole: actor?.role,
      body: await req.json(),
    });

    if (result.status === "unauthorized") return errorJson("Unauthorized", 401);
    if (result.status === "missing_fields") {
      return errorJson("Name, email, password and role are required", 400);
    }
    if (result.status === "super_admin_create_forbidden") {
      return errorJson("Only super_admin can create another super_admin", 403);
    }
    if (result.status === "conflict") {
      return errorJson(`A user with this ${result.conflict} already exists`, 400);
    }

    return successJson({ user: result.user }, 201);
  } catch (error: any) {
    console.error("Error creating employee:", error);
    const msg = error?.code === "P2002" ? "A user with this email or phone already exists" : "Internal Server Error";
    return errorJson(msg, 500);
  }
}

/**
 * PATCH /api/hr/employees
 * Updates an employee's User fields and HrRecord (salary/target/level).
 * Also used for the Active/Inactive toggle.
 */
export async function PATCH(req: Request) {
  const actor = await getSessionUser();

  try {
    const result = await updateEmployee({
      actorRole: actor?.role,
      body: await req.json(),
    });

    if (result.status === "unauthorized") return errorJson("Unauthorized", 401);
    if (result.status === "missing_id") return errorJson("Employee id is required", 400);
    if (result.status === "not_found") return errorJson("Employee not found", 404);
    if (result.status === "super_admin_edit_forbidden") {
      return errorJson("HR cannot edit super_admin users", 403);
    }
    if (result.status === "super_admin_grant_forbidden") {
      return errorJson("Only super_admin can grant super_admin role", 403);
    }

    return successJson({ user: result.user });
  } catch (error: any) {
    console.error("Error updating employee:", error);
    return errorJson("Internal Server Error", 500);
  }
}
