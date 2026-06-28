export const dynamic = "force-dynamic";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { listMeetingLinkNotifications, listUnreadNotifications } from "@/server/services/notificationService";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  try {
    const url = new URL(req.url);
    const notifications =
      url.searchParams.get("type") === "meeting_links"
        ? await listMeetingLinkNotifications(user.id)
        : await listUnreadNotifications(user.id);
    return successJson({ data: notifications }, 200);
  } catch (err: any) {
    console.error("Notifications API error:", err);
    return errorJson(err.message, 500);
  }
}
