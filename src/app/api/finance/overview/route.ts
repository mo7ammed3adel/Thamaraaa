import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { getFinanceOverview } from "@/server/services/financeService";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || (user.role !== "accountant" && user.role !== "super_admin")) {
    return errorJson("Unauthorized", 401);
  }

  try {
    return successJson(await getFinanceOverview());
  } catch (error) {
    return errorJson("Server error", 500);
  }
}
