import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { listScreenshots } from "@/server/services/deviceMonitoringService";

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
