export const dynamic = "force-dynamic";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { getSessionUser } from "@/server/auth/session";
import { listLeaveRequests, submitLeaveRequest } from "@/server/services/hrService";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedJson();

    const requestOut = await submitLeaveRequest({
      userId: user.id,
      userName: user.name,
      body: await req.json(),
    });

    if (requestOut.status === "not_eligible") {
      const months = requestOut.probationMonths ?? 3;
      return errorJson(
        `Annual leave is not available during the ${months}-month probation period`,
        400
      );
    }
    if (requestOut.status === "insufficient_balance") {
      return errorJson("Requested leave exceeds available balance", 400, { balance: requestOut.balance });
    }
    if (requestOut.status === "permission_limit") {
      return errorJson("Permission allowance is 6 hours per month and max 6 hours per request", 400);
    }

    return successJson(requestOut, 201);
  } catch (error: any) {
    return errorJson(error.message, 500);
  }
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedJson();

    return successJson(await listLeaveRequests({ userId: user.id, userRole: user.role }));
  } catch (error: any) {
    return errorJson(error.message, 500);
  }
}
