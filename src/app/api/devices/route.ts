import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { enrolDevice, listDevices } from "@/server/services/deviceMonitoringService";

/** GET /api/devices — every enrolled device (super admin only). */
export async function GET() {
  const user = await getSessionUser();
  if (!user?.id || !user.role) return unauthorizedJson();

  const result = await listDevices(user.role);
  if (result.status === "forbidden") return errorJson("Forbidden", 403);
  return successJson({ devices: result.devices });
}

/**
 * POST /api/devices — enrol a device for an employee.
 * Returns the plaintext token once; only its hash is stored.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user?.id || !user.role) return unauthorizedJson();

  const body = await req.json();
  const result = await enrolDevice({
    actor: { id: user.id, role: user.role },
    userId: body?.userId,
    label: body?.label,
    hostname: body?.hostname,
    platform: body?.platform,
  });

  if (result.status === "forbidden") return errorJson("Forbidden", 403);
  if (result.status === "missing_user") return errorJson("userId is required", 400);
  if (result.status === "user_not_found") return errorJson("Employee not found", 404);

  return successJson({ device: result.device, token: result.token }, 201);
}
