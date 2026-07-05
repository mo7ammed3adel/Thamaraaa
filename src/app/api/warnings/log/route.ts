import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listWarningLog } from "@/server/services/warningService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;

    if (!["head_account_manager", "head_technical", "super_admin"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden: Only admins can view the warning log" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const warnings = await listWarningLog({
      user: { id: user.id, role: user.role },
      filters: {
        projectId: searchParams.get("projectId"),
        severity: searchParams.get("severity"),
        from: searchParams.get("from"),
        to: searchParams.get("to"),
      },
    });

    return NextResponse.json({ warnings });
  } catch (error: any) {
    console.error("Fetch Warnings Log Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
