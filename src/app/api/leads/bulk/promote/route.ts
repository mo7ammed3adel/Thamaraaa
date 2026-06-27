import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bulkPromoteLeads } from "@/server/services/leadService";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (
      !user ||
      (user.role !== "tele_sales_agent" && user.role !== "super_admin" && user.role !== "tele_sales_manager")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await bulkPromoteLeads({
      user: { id: user.id, role: user.role, name: user.name },
      body: await req.json(),
    });

    if (result.status === "no_leads_selected") {
      return NextResponse.json({ error: "No leads selected" }, { status: 400 });
    }
    if (result.status === "all_duplicates") {
      return NextResponse.json(
        { error: "Promotion failed: All selected leads are already active inside the system." },
        { status: 400 }
      );
    }

    return NextResponse.json({ promotedCount: result.promotedCount, message: result.message }, { status: 200 });
  } catch (error) {
    console.error("Bulk promote error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
