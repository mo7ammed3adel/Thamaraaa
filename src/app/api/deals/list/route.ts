export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listClosedDealsForUser } from "@/server/services/dealService";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !["super_admin", "chief_sales", "tele_sales_manager", "tele_sales_agent", "sales_manager", "sales_agent"].includes(
        user.role
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(await listClosedDealsForUser({ id: user.id, role: user.role }));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
