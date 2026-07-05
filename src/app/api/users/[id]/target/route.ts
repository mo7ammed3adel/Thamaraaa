import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setAgentMonthlyTarget } from "@/server/services/userService";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const actor = session?.user as any;

    // Only allow managers or super admins
    if (!session || !["super_admin", "tele_sales_manager", "sales_manager"].includes(actor?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { target, month } = await request.json();

    const result = await setAgentMonthlyTarget({
      actor: { id: actor.id, role: actor.role },
      id: params.id,
      target,
      month,
    });

    if (result.status === "invalid_target") {
      return NextResponse.json({ error: "Invalid target value" }, { status: 400 });
    }
    if (result.status === "not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden: you can only set targets for your own direct agents" }, { status: 403 });
    }

    return NextResponse.json(result.target);
  } catch (error) {
    console.error("Failed to update target:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
