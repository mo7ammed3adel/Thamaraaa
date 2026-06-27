import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteLead, updateLead } from "@/server/services/leadService";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const result = await updateLead({
      id: params.id,
      user: { id: user.id, role: user.role, name: user.name },
      body: await request.json(),
    });

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden: You are not assigned to this lead." }, { status: 403 });
    }
    if (result.status === "sales_reassign_forbidden") {
      return NextResponse.json({ error: "Only Sales Managers can reassign sales leads" }, { status: 403 });
    }
    if (result.status === "invalid_sales_assignee") {
      return NextResponse.json({ error: "Invalid sales assignee" }, { status: 400 });
    }
    if (result.status === "tele_reassign_forbidden") {
      return NextResponse.json({ error: "Only TeleSales Managers can reassign TeleSales leads" }, { status: 403 });
    }
    if (result.status === "invalid_tele_assignee") {
      return NextResponse.json({ error: "Invalid TeleSales assignee" }, { status: 400 });
    }
    if (result.status === "invalid_store_link") {
      return NextResponse.json({ error: "storeLink must be a valid http(s) URL" }, { status: 400 });
    }

    return NextResponse.json({ success: true, lead: result.lead });
  } catch (error: any) {
    console.error("Error updating lead:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || !["super_admin", "tele_sales_manager"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await deleteLead({
      id: params.id,
      user: { id: user.id, role: user.role, name: user.name },
    });

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (result.status === "delete_forbidden") {
      return NextResponse.json({ error: "Forbidden: you can only delete leads assigned to your team" }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting lead:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
