export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMyProgress } from "@/server/services/analyticsService";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const result = await getMyProgress({
      id: user.id,
      role: user.role,
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    if (result.status === "role_not_supported") {
      return NextResponse.json({ error: "Role not supported" }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
