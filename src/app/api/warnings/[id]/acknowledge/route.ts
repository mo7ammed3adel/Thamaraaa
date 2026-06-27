import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { acknowledgeWarningForUser } from "@/server/services/warningService";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedJson();

    const result = await acknowledgeWarningForUser({
      warningId: params.id,
      userId: user.id,
      userName: user.name,
    });

    if (result.status === "not_found") return errorJson("Warning receipt not found", 404);
    if (result.status === "already_read") return errorJson("Warning already acknowledged", 400);

    return successJson({ success: true, receipt: result.receipt });
  } catch (error: any) {
    console.error("Acknowledge Warning Error:", error);
    return errorJson("Internal Server Error", 500, { details: error.message });
  }
}
