import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { decideLeaveRequest } from "@/server/services/hrService";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();

    if (!user || (user.role !== "hr_manager" && user.role !== "super_admin")) {
      return errorJson("Unauthorized", 401);
    }

    const { id } = params;
    const { status, feedbackNotes } = await req.json();

    const leaveRequest = await decideLeaveRequest({ id, status, feedbackNotes });

    return successJson(leaveRequest);
  } catch (error: any) {
    return errorJson(error.message, 500);
  }
}
