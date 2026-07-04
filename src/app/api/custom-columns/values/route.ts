import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setCustomColumnValue } from "@/server/services/referenceDataService";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["super_admin", "tele_sales_manager", "tele_sales_agent"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { columnId, leadId, value } = await req.json();

    const result = await setCustomColumnValue({
      actor: { id: user.id, role: user.role },
      columnId,
      leadId,
      value,
    });

    if (result.status === "missing_fields") {
      return NextResponse.json({ error: "columnId and leadId are required" }, { status: 400 });
    }
    if (result.status === "lead_forbidden") {
      return NextResponse.json({ error: "Forbidden: you cannot edit this lead" }, { status: 403 });
    }

    return NextResponse.json(result.result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
