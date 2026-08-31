import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { deleteDevice, updateDevice } from "@/server/services/deviceMonitoringService";

/** PATCH /api/devices/[id] — reassign the owner and/or rename (super admin). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user?.id || !user.role) return unauthorizedJson();

  const body = await req.json();
  const result = await updateDevice({
    actorRole: user.role,
    deviceId: params.id,
    userId: body?.userId,
    label: body?.label,
  });

  if (result.status === "forbidden") return errorJson("Forbidden", 403);
  if (result.status === "not_found") return errorJson("Device not found", 404);
  if (result.status === "missing_user") return errorJson("userId cannot be empty", 400);
  if (result.status === "user_not_found") return errorJson("Employee not found", 404);
  if (result.status === "no_changes") return errorJson("Nothing to update", 400);
  return successJson({ device: result.device });
}

/** DELETE /api/devices/[id] — remove the device and all its captures (super admin). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user?.id || !user.role) return unauthorizedJson();

  const result = await deleteDevice({ actorRole: user.role, deviceId: params.id });

  if (result.status === "forbidden") return errorJson("Forbidden", 403);
  if (result.status === "not_found") return errorJson("Device not found", 404);
  if (result.status === "files_failed") return errorJson("Could not remove all screenshot files — try again", 500);
  return successJson({ deletedScreenshots: result.deletedScreenshots });
}
