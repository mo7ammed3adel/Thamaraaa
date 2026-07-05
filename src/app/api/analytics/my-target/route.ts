export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAgentTargetHistory } from "@/server/services/targetService";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await getAgentTargetHistory({ id: user.id, role: user.role });
    if (result.status === "role_not_supported") {
      return NextResponse.json({ error: "Role not supported" }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Failed to load target history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
