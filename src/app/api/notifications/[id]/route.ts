import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  try {
    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });

    if (!notification || notification.userId !== user.id) {
      return errorJson("Notification not found", 404);
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true }
    });
    return successJson({ success: true }, 200);
  } catch (err: any) {
    return errorJson(err.message, 500);
  }
}
