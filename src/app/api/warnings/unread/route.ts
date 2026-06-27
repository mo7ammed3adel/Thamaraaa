import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { listUnreadWarningsWithSenderRole } from "@/server/services/warningService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedJson();

    const warnings = await listUnreadWarningsWithSenderRole(user.id);
    return successJson({ warnings });
  } catch (error: any) {
    console.error("Fetch Unread Warnings Error:", error);
    return errorJson("Internal Server Error", 500, { details: error.message });
  }
}
