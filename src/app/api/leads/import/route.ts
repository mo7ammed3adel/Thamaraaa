import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { importLeadsFromExcel } from "@/server/services/leadService";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!["super_admin", "tele_sales_manager"].includes(user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const formData = await req.formData();
    const result = await importLeadsFromExcel({
      user: { id: user.id, role: user.role, name: user.name },
      file: formData.get("file") as File | null,
      assignToAgentId: formData.get("assignToAgentId") as string | null,
      companyId: (formData.get("companyId") as string | null) || null,
    });

    if (result.status === "no_file") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (result.status === "invalid_tele_assignee") {
      return NextResponse.json({ error: "Invalid TeleSales assignee" }, { status: 400 });
    }
    if (result.status === "empty_file") {
      return NextResponse.json({ error: "Excel file is empty" }, { status: 400 });
    }
    if (result.status === "missing_required_columns") {
      return NextResponse.json(
        {
          error: "Excel must have at least 'Name' and 'Phone' columns",
          detectedHeaders: result.detectedHeaders,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      imported: result.imported,
      skipped: result.skipped,
      totalRows: result.totalRows,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Lead import error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
