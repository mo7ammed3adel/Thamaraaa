import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveSessionUser } from "@/lib/activeSessionUser";
import { createManualLead } from "@/server/services/leadService";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as any;
    const user = await getActiveSessionUser(sessionUser);

    if (
      !user ||
      (user.role !== "tele_sales_agent" && user.role !== "super_admin" && user.role !== "tele_sales_manager")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await createManualLead({
      user: { id: user.id, role: user.role, name: user.name },
      body: await req.json(),
    });

    if (result.status === "missing_name_phone") {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
    }
    if (result.status === "invalid_store_link") {
      return NextResponse.json({ error: "storeLink must be a valid http(s) URL" }, { status: 400 });
    }
    if (result.status === "invalid_tele_assignee") {
      return NextResponse.json({ error: "Invalid TeleSales assignee" }, { status: 400 });
    }

    return NextResponse.json(result.lead, { status: 201 });
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
