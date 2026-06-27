import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { updateInstallmentPayment } from "@/server/services/financeService";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "accountant" && user.role !== "super_admin")) {
    return errorJson("Unauthorized", 401);
  }

  try {
    const result = await updateInstallmentPayment({
      id: params.id,
      userId: user.id,
      body: await req.json(),
    });

    if (result.status === "invalid_is_paid") return errorJson("isPaid must be boolean", 400);
    if (result.status === "not_found") return errorJson("Installment not found", 404);

    return successJson({ success: true, installment: result.installment });
  } catch (err) {
    return errorJson("Server error", 500);
  }
}
