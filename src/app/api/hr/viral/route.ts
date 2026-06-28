import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import {
  createHrmResource,
  deleteHrmResource,
  getViralHrmDashboard,
  updateHrmResource,
} from "@/server/services/hrmService";

const HR_ROLES = ["super_admin", "hr_manager"];

function isHr(role?: string | null) {
  return HR_ROLES.includes(role || "");
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!isHr(user?.role)) return errorJson("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  try {
    return successJson(await getViralHrmDashboard(searchParams.get("month")));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Viral HRM GET error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!isHr(user?.role)) return errorJson("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body?.resource) return errorJson("resource is required", 400);

  try {
    const result = await createHrmResource({
      actorId: user!.id,
      resource: body.resource,
      body,
    });
    if ((result as any)?.status === "invalid_weights") {
      return errorJson(`KPI weights must sum to 100. Current total: ${(result as any).total}`, 400);
    }
    if ((result as any)?.status === "rejected_by_rule") {
      return errorJson((result as any).reason, 400);
    }
    if ((result as any)?.status === "locked_period") {
      return errorJson("Payroll period is locked or published", 400);
    }
    return successJson({ result }, 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Viral HRM POST error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!isHr(user?.role)) return errorJson("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body?.resource) return errorJson("resource is required", 400);

  try {
    const result = await updateHrmResource({
      actorId: user!.id,
      resource: body.resource,
      body,
    });
    if ((result as any)?.status === "missing_id") return errorJson("id is required", 400);
    if ((result as any)?.status === "invalid_weights") {
      return errorJson(`KPI weights must sum to 100. Current total: ${(result as any).total}`, 400);
    }
    return successJson({ result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Viral HRM PATCH error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!isHr(user?.role)) return errorJson("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  const resource = searchParams.get("resource") as any;
  const id = searchParams.get("id");
  if (!resource || !id) return errorJson("resource and id are required", 400);

  try {
    const result = await deleteHrmResource(resource, id);
    return successJson({ result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Viral HRM DELETE error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}
