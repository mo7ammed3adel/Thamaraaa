import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { reissueDeviceToken } from "@/server/services/deviceMonitoringService";

/**
 * POST /api/devices/[id]/reissue-token — mint a new token for an existing
 * device and kill the old one (super admin). Returns the plaintext token once.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user?.id || !user.role) return unauthorizedJson();

  const result = await reissueDeviceToken({ actorRole: user.role, deviceId: params.id });

  if (result.status === "forbidden") return errorJson("Forbidden", 403);
  if (result.status === "not_found") return errorJson("Device not found", 404);
  return successJson({ token: result.token });
}
