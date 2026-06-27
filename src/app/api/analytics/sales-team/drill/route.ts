export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSalesTeamDrill } from "@/server/services/analyticsService";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || !["super_admin", "sales_manager"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const result = await getSalesTeamDrill({
      id: user.id,
      role: user.role,
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      drillDown: searchParams.get("drillDown"),
    });

    if (result.status === "invalid_drill_down") {
      return NextResponse.json({ error: "Invalid drillDown type" }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
