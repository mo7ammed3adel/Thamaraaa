export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSalesTeamAnalytics } from "@/server/services/analyticsService";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || !["super_admin", "sales_manager"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const analytics = await getSalesTeamAnalytics({
      id: user.id,
      role: user.role,
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    return NextResponse.json(analytics);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
