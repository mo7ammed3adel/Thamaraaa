import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import {
  getScreenshotRetentionDays,
  setScreenshotRetentionDays,
} from "@/server/services/deviceMonitoringService";

/** GET /api/devices/retention — how long captures are kept, in days. */
export async function GET() {
  const user = await getSessionUser();
  if (!user?.role) return unauthorizedJson();
  if (user.role !== "super_admin") return errorJson("Forbidden", 403);
  return successJson({ days: await getScreenshotRetentionDays() });
}

/** PUT /api/devices/retention — set it (super admin only). */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user?.role) return unauthorizedJson();

  const body = await req.json();
  const result = await setScreenshotRetentionDays({ actorRole: user.role, days: body?.days });
  if (result.status === "forbidden") return errorJson("Forbidden", 403);
  return successJson({ days: result.days });
}
