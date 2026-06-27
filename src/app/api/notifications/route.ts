export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id, read: false },
      orderBy: { createdAt: "desc" }
    });
    return successJson({ data: notifications }, 200);
  } catch (err: any) {
    console.error("Notifications API error:", err);
    return errorJson(err.message, 500);
  }
}
