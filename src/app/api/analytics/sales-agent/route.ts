export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSalesAgentAnalytics } from "@/server/services/analyticsService";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || !["super_admin", "sales_manager"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const result = await getSalesAgentAnalytics({
      id: user.id,
      role: user.role,
      agentId,
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden: agent is not in your team" }, { status: 403 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
