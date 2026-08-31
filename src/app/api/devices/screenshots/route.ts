import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { deleteScreenshots, listScreenshots } from "@/server/services/deviceMonitoringService";

/** GET /api/devices/screenshots — a filtered, paginated list (super admin). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user?.role) return unauthorizedJson();

  const q = new URL(req.url).searchParams;
  const result = await listScreenshots({
    actorRole: user.role,
    userId: q.get("userId"),
    deviceId: q.get("deviceId"),
    from: q.get("from"),
    to: q.get("to"),
    page: q.get("page") ? parseInt(q.get("page")!, 10) : 1,
  });

  if (result.status === "forbidden") return errorJson("Forbidden", 403);
  return successJson({ screenshots: result.screenshots, pagination: result.pagination });
}

/** DELETE /api/devices/screenshots — permanently removes the given screenshots,
 * image and record both (super admin). Body: { ids: string[] }. */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user?.role) return unauthorizedJson();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorJson("Expected a JSON body", 400);
  }

  const result = await deleteScreenshots({
    actorRole: user.role,
    ids: (body as { ids?: unknown })?.ids,
  });

  if (result.status === "forbidden") return errorJson("Forbidden", 403);
  if (result.status === "no_ids") return errorJson("No screenshots selected", 400);
  if (result.status === "too_many") return errorJson("Too many screenshots in one request", 400);
  return successJson({ deleted: result.deleted, failed: result.failed });
}
