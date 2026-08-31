import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { getScreenshotInterval, setScreenshotInterval } from "@/server/services/deviceMonitoringService";

/** GET /api/devices/interval — the current capture interval, in minutes. */
export async function GET() {
  const user = await getSessionUser();
  if (!user?.role) return unauthorizedJson();
  if (user.role !== "super_admin") return errorJson("Forbidden", 403);
  return successJson({ minutes: await getScreenshotInterval() });
}

/** PUT /api/devices/interval — set it (super admin only). */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user?.role) return unauthorizedJson();

  const body = await req.json();
  const result = await setScreenshotInterval({ actorRole: user.role, minutes: body?.minutes });
  if (result.status === "forbidden") return errorJson("Forbidden", 403);
  return successJson({ minutes: result.minutes });
}
