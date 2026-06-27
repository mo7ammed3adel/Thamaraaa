export const dynamic = "force-dynamic";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { addJobApplicant, listJobApplicants } from "@/server/services/hrService";

function canUseHr(userRole?: string | null) {
  return ["super_admin", "hr_manager"].includes(userRole || "");
}

export async function GET() {
  const user = await getSessionUser();
  if (!canUseHr(user?.role)) {
    return errorJson("Unauthorized", 403);
  }

  try {
    return successJson({ data: await listJobApplicants() }, 200);
  } catch (err: any) {
    return errorJson(err.message, 500);
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!canUseHr(user?.role)) {
    return errorJson("Unauthorized", 403);
  }

  try {
    return successJson({ data: await addJobApplicant(await req.json()) }, 201);
  } catch (err: any) {
    return errorJson(err.message, 500);
  }
}
