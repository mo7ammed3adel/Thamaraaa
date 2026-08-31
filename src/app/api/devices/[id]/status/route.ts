import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { changeDeviceStatus } from "@/server/services/deviceMonitoringService";

/** PATCH /api/devices/[id]/status — Active | Paused | Revoked (super admin). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user?.id || !user.role) return unauthorizedJson();

  const body = await req.json();
  const result = await changeDeviceStatus({
    actorRole: user.role,
    deviceId: params.id,
    status: body?.status,
  });

  if (result.status === "forbidden") return errorJson("Forbidden", 403);
  if (result.status === "invalid_status") return errorJson("status must be Active, Paused or Revoked", 400);
  if (result.status === "not_found") return errorJson("Device not found", 404);
  return successJson({ device: result.device });
}
