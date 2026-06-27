import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClosedDeal } from "@/server/services/dealService";

/**
 * POST /api/deals
 * Creates a new deal when a Sales Agent closes a sale AND creates its Operations
 * project in the same transaction, so a closed deal can never be orphaned without
 * a project (spec §7, §22). Head Account Managers are notified to distribute it.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || (user.role !== "sales_agent" && user.role !== "super_admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await createClosedDeal({
      userId: user.id,
      userRole: user.role,
      body: await req.json(),
    });

    if (result.status === "missing_required") {
      return NextResponse.json({ error: "leadId, packageType, and totalAmount are required" }, { status: 400 });
    }
    if (result.status === "negative_total") {
      return NextResponse.json({ error: "Total amount cannot be negative" }, { status: 400 });
    }
    if (result.status === "invalid_urls") {
      return NextResponse.json({ error: "Contract and receipt links must be valid http(s) URLs" }, { status: 400 });
    }
    if (result.status === "lead_not_found") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden: You are not assigned to this lead." }, { status: 403 });
    }

    return NextResponse.json(result.deal, { status: 201 });
  } catch (error) {
    console.error("Failed to create deal:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
