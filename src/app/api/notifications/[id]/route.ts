import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { markNotificationReadForUser } from "@/server/services/notificationService";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  try {
    const didMarkRead = await markNotificationReadForUser(params.id, user.id);
    if (!didMarkRead) {
      return errorJson("Notification not found", 404);
    }
    return successJson({ success: true }, 200);
  } catch (err: any) {
    return errorJson(err.message, 500);
  }
}
