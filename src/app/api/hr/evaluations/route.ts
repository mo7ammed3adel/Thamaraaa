import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { evaluateHrRecords } from "@/server/services/hrService";

export async function POST(req: Request) {
  const user = await getSessionUser();
  const userRole = user?.role || "";
  
  if (!["super_admin", "hr_manager"].includes(userRole)) {
    return errorJson("Unauthorized", 403);
  }

  try {
    return successJson(await evaluateHrRecords());
  } catch (error: any) {
    console.error("Evaluation error:", error);
    return errorJson("Internal Server Error", 500);
  }
}
