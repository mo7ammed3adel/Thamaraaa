import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listProjectLogs } from "@/server/services/projectLifecycleService";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const user = session.user as { id: string; role: string };

    const result = await listProjectLogs({ userId: user.id, userRole: user.role, projectId: params.id });
    if (result.status === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json(result.logs);
  } catch (error) {
    console.error("Failed to fetch project logs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
