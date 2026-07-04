import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { importLeadsFromExcel } from "@/server/services/leadService";
import * as XLSX from "xlsx";

const LEAD_TEMPLATE_HEADERS = [
  "Name",
  "Phone",
  "Source",
  "Classification",
  "Nationality",
  "Gender",
  "Customer Type",
  "Store Link",
];

const LEAD_TEMPLATE_INSTRUCTIONS = [
  ["Field", "Required", "Notes"],
  ["Name", "YES", "Full customer name"],
  ["Phone", "YES", "Phone number. Duplicate phones are skipped."],
  ["Source", "no", "Lead source, campaign, or channel"],
  ["Classification", "no", "Hot, Warm, or Cold. Empty values default to Cold."],
  ["Nationality", "no", "Customer nationality"],
  ["Gender", "no", "Customer gender"],
  ["Customer Type", "no", "Store, Launch, Dropshipping, Shipping, or Special"],
  ["Store Link", "no", "Customer store URL, if available"],
];

function buildLeadImportTemplate() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([LEAD_TEMPLATE_HEADERS]);
  worksheet["!cols"] = LEAD_TEMPLATE_HEADERS.map(() => ({ wch: 22 }));

  const instructionsSheet = XLSX.utils.aoa_to_sheet(LEAD_TEMPLATE_INSTRUCTIONS);
  instructionsSheet["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 72 }];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!["super_admin", "tele_sales_manager", "tele_sales_agent"].includes(user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const template = buildLeadImportTemplate();
  return new NextResponse(new Uint8Array(template), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="leads_import_template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!["super_admin", "tele_sales_manager", "tele_sales_agent"].includes(user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const formData = await req.formData();
    const result = await importLeadsFromExcel({
      user: { id: user.id, role: user.role, name: user.name },
      file: formData.get("file") as File | null,
      assignToAgentId:
        user.role === "tele_sales_agent" ? user.id : (formData.get("assignToAgentId") as string | null),
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
