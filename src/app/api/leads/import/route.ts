import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import { normalizeWebUrl } from "@/lib/safe-url";

/**
 * Column name mapping: maps common Arabic/English Excel header variations
 * to the Lead model field names.
 */
const COLUMN_MAP: Record<string, string> = {
  // Name
  "name": "name",
  "الاسم": "name",
  "اسم العميل": "name",
  "client name": "name",
  "customer name": "name",
  "full name": "name",
  "lead name": "name",
  // Phone
  "phone": "phone",
  "الهاتف": "phone",
  "رقم الهاتف": "phone",
  "mobile": "phone",
  "الموبايل": "phone",
  "phone number": "phone",
  "رقم الموبايل": "phone",
  "tel": "phone",
  // Source
  "source": "source",
  "المصدر": "source",
  "campaign": "source",
  "الحملة": "source",
  "ad source": "source",
  "مصدر الحملة": "source",
  // Classification
  "classification": "classification",
  "التصنيف": "classification",
  "type": "classification",
  "النوع": "classification",
  "lead type": "classification",
  // Nationality
  "nationality": "nationality",
  "الجنسية": "nationality",
  // Gender
  "gender": "gender",
  "الجنس": "gender",
  "النوع الاجتماعي": "gender",
  // Customer Type
  "customer type": "customerType",
  "نوع العميل": "customerType",
  "customer_type": "customerType",
  // Store Link
  "store link": "storeLink",
  "رابط المتجر": "storeLink",
  "store url": "storeLink",
  "store_link": "storeLink",
};

/** Normalize a header string for column matching */
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_\-]+/g, " ");
}

/** Validate and clean phone number */
function cleanPhone(raw: unknown): string {
  if (!raw) return "";
  return String(raw).replace(/[^\d+]/g, "").trim();
}

/** Validate classification value */
function normalizeClassification(val: string): string {
  const map: Record<string, string> = {
    hot: "Hot", warm: "Warm", cold: "Cold",
    ساخن: "Hot", دافئ: "Warm", بارد: "Cold",
  };
  return map[val.toLowerCase()] || "Cold";
}

export async function POST(req: Request) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!["super_admin", "tele_sales_manager"].includes(userRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const assignToAgentId = formData.get("assignToAgentId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "Excel file is empty" }, { status: 400 });
    }

    // Build column mapping from actual headers
    const excelHeaders = Object.keys(rawRows[0]);
    const fieldMapping: Record<string, string> = {};
    for (const header of excelHeaders) {
      const normalized = normalizeHeader(header);
      if (COLUMN_MAP[normalized]) {
        fieldMapping[header] = COLUMN_MAP[normalized];
      }
    }

    // Check required mapping
    const mappedFields = Object.values(fieldMapping);
    if (!mappedFields.includes("name") || !mappedFields.includes("phone")) {
      return NextResponse.json({
        error: "Excel must have at least 'Name' and 'Phone' columns",
        detectedHeaders: excelHeaders,
      }, { status: 400 });
    }

    // Get existing phone numbers for deduplication
    const existingLeads = await prisma.lead.findMany({
      select: { phone: true },
    });
    const existingPhones = new Set(existingLeads.map((l) => l.phone));

    // Process rows
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Auto-assignment preparation
    let hotAgents: { id: string, specialization: string | null }[] = [];
    let coldAgents: { id: string, specialization: string | null }[] = [];
    let hotIndex = 0;
    let coldIndex = 0;

    if (!assignToAgentId) {
      const allAgents = await prisma.user.findMany({
        where: { role: "tele_sales_agent", status: "Active" },
        select: { id: true, specialization: true }
      });
      hotAgents = allAgents.filter(a => a.specialization === "Hot");
      coldAgents = allAgents.filter(a => a.specialization === "Cold" || a.specialization === "Warm" || !a.specialization);
      // Fallbacks if one pool is empty
      if (hotAgents.length === 0) hotAgents = [...coldAgents];
      if (coldAgents.length === 0) coldAgents = [...hotAgents];
    }

    const agentAssignCounts: Record<string, number> = {};

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2; // Excel row (1-indexed header + 1)

      try {
        // Map row values to Lead fields
        const mapped: Record<string, string> = {};
        for (const [excelCol, fieldName] of Object.entries(fieldMapping)) {
          mapped[fieldName] = String(row[excelCol] ?? "").trim();
        }

        const name = mapped.name;
        const phone = cleanPhone(mapped.phone);

        if (!name || !phone) {
          errors.push(`Row ${rowNum}: Missing name or phone`);
          continue;
        }

        // Skip duplicates
        if (existingPhones.has(phone)) {
          skipped++;
          continue;
        }

        const classification = mapped.classification
          ? normalizeClassification(mapped.classification)
          : "Cold";

        let finalAgentId = assignToAgentId;

        if (!finalAgentId) {
          if (classification === "Hot" && hotAgents.length > 0) {
            finalAgentId = hotAgents[hotIndex % hotAgents.length].id;
            hotIndex++;
          } else if (coldAgents.length > 0) {
            finalAgentId = coldAgents[coldIndex % coldAgents.length].id;
            coldIndex++;
          }
        }

        const safeStoreLink = mapped.storeLink ? normalizeWebUrl(mapped.storeLink) : null;
        if (mapped.storeLink && !safeStoreLink) {
          errors.push(`Row ${rowNum}: invalid store link`);
          continue;
        }

        await prisma.lead.create({
          data: {
            name,
            phone,
            source: mapped.source || null,
            nationality: mapped.nationality || null,
            gender: mapped.gender || null,
            customerType: mapped.customerType || null,
            storeLink: safeStoreLink,
            hasStore: !!safeStoreLink,
            classification,
            status: "New",
            assignedTeleAgentId: finalAgentId || null,
          },
        });

        if (finalAgentId && !assignToAgentId) {
          agentAssignCounts[finalAgentId] = (agentAssignCounts[finalAgentId] || 0) + 1;
        }

        existingPhones.add(phone); // Prevent intra-batch duplicates
        imported++;
      } catch (rowError) {
        errors.push(`Row ${rowNum}: ${(rowError as Error).message}`);
      }
    }

    if (assignToAgentId && imported > 0) {
      await prisma.notification.create({
        data: {
          userId: assignToAgentId,
          title: "New Leads Assigned",
          message: `You have been assigned ${imported} new leads from the latest Excel import.`,
          link: "/dashboard/telesales"
        }
      });
    } else if (!assignToAgentId && Object.keys(agentAssignCounts).length > 0) {
      for (const [agentId, count] of Object.entries(agentAssignCounts)) {
        await prisma.notification.create({
          data: {
            userId: agentId,
            title: "New Leads Auto-Assigned",
            message: `You have been automatically assigned ${count} new leads from the latest Excel import.`,
            link: "/dashboard/telesales"
          }
        });
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      totalRows: rawRows.length,
      errors: errors.slice(0, 20), // Cap error messages
    });
  } catch (error) {
    console.error("Lead import error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
