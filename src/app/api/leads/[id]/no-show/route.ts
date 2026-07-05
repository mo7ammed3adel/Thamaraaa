import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reportClientNoShow } from "@/server/services/leadService";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const result = await reportClientNoShow({
      id: params.id,
      user: { id: user.id, role: user.role, name: user.name },
    });

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden: you are not assigned to this meeting." }, { status: 403 });
    }

    return NextResponse.json({ success: true, lead: result.lead });
  } catch (error: any) {
    console.error("Error reporting client no-show:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
