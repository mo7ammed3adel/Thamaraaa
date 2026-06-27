import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { editJobApplicant } from "@/server/services/hrService";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!["super_admin", "hr_manager"].includes(user?.role || "")) {
    return errorJson("Unauthorized", 403);
  }

  try {
    return successJson({ data: await editJobApplicant(params.id, await req.json()) }, 200);
  } catch (err: any) {
    return errorJson(err.message, 500);
  }
}
