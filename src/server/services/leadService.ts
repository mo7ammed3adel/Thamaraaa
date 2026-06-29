import { resolveManualLeadAssigneeId } from "@/lib/manualLeadAssignment";
import { autoAssignLead } from "@/lib/autoAssign";
import { canManuallyDistributeMeeting } from "@/lib/meetingDistribution";
import { normalizeWebUrl } from "@/lib/safe-url";
import * as XLSX from "xlsx";
import {
  createLeadCallLog,
  createLeadNotification,
  createImportedLead,
  createManualLeadRecord,
  findUserCompanyId,
  deleteLeadRecord,
  deleteDraftLeads,
  findActiveTeleSalesAgents,
  findExistingLeadPhones,
  findActiveLeadPhones,
  findDistributedLead,
  findDraftLeadsForBulk,
  findLatestLeadMeeting,
  findLeadAssigneeForManualCreate,
  findLeadAssigneeForUpdate,
  findLeadForMeetingDistribution,
  findLeadForDelete,
  findLeadForUpdate,
  promoteDraftLeads,
  updateLeadMeeting,
  updateLeadRecord,
} from "@/server/repositories/leadRepository";

type LeadUser = {
  id: string;
  role: string;
  name?: string | null;
};

const IMPORT_COLUMN_MAP: Record<string, string> = {
  name: "name",
  "الاسم": "name",
  "اسم العميل": "name",
  "client name": "name",
  "customer name": "name",
  "full name": "name",
  "lead name": "name",
  phone: "phone",
  "الهاتف": "phone",
  "رقم الهاتف": "phone",
  mobile: "phone",
  "الموبايل": "phone",
  "phone number": "phone",
  "رقم الموبايل": "phone",
  tel: "phone",
  source: "source",
  "المصدر": "source",
  campaign: "source",
  "الحملة": "source",
  "ad source": "source",
  "مصدر الحملة": "source",
  classification: "classification",
  "التصنيف": "classification",
  type: "classification",
  "النوع": "classification",
  "lead type": "classification",
  nationality: "nationality",
  "الجنسية": "nationality",
  gender: "gender",
  "الجنس": "gender",
  "النوع الاجتماعي": "gender",
  "customer type": "customerType",
  "نوع العميل": "customerType",
  customer_type: "customerType",
  "store link": "storeLink",
  "رابط المتجر": "storeLink",
  "store url": "storeLink",
  store_link: "storeLink",
};

function normalizeImportHeader(header: string) {
  return header.trim().toLowerCase().replace(/[_\-]+/g, " ");
}

function cleanImportPhone(raw: unknown) {
  if (!raw) return "";
  return String(raw).replace(/[^\d+]/g, "").trim();
}

function normalizeImportClassification(value: string) {
  const map: Record<string, string> = {
    hot: "Hot",
    warm: "Warm",
    cold: "Cold",
    ساخن: "Hot",
    دافئ: "Warm",
    بارد: "Cold",
  };
  return map[value.toLowerCase()] || "Cold";
}

export async function createManualLead(input: { user: LeadUser; body: any }) {
  const { name, phone, storeLink, niche, classification, assignedTeleAgentId, status, companyId } = input.body;

  if (!name || !phone) {
    return { status: "missing_name_phone" as const };
  }

  const safeStoreLink = storeLink ? normalizeWebUrl(storeLink) : null;
  if (storeLink && !safeStoreLink) {
    return { status: "invalid_store_link" as const };
  }

  let sourceName = `Manual - ${input.user.name}`;
  if (input.user.role === "super_admin" || input.user.role === "tele_sales_manager") {
    sourceName = `Manual (${input.user.role.replace(/_/g, " ")}) - ${input.user.name}`;
  }

  const finalTeleAgentId = resolveManualLeadAssigneeId({
    creatorId: input.user.id,
    creatorRole: input.user.role,
    requestedTeleAgentId: assignedTeleAgentId,
  });

  if (finalTeleAgentId && input.user.role === "tele_sales_manager") {
    const targetAgent = await findLeadAssigneeForManualCreate(finalTeleAgentId);
    if (
      !targetAgent ||
      targetAgent.role !== "tele_sales_agent" ||
      targetAgent.status !== "Active" ||
      targetAgent.directManagerId !== input.user.id
    ) {
      return { status: "invalid_tele_assignee" as const };
    }
  }

  if (finalTeleAgentId && input.user.role === "super_admin") {
    const targetAgent = await findLeadAssigneeForManualCreate(finalTeleAgentId);
    if (!targetAgent || targetAgent.role !== "tele_sales_agent" || targetAgent.status !== "Active") {
      return { status: "invalid_tele_assignee" as const };
    }
  }

  // A lead inherits the company of its telesales agent when one isn't chosen
  // explicitly, so company-scoped distribution always has a company to honour.
  let leadCompanyId: string | null = companyId || null;
  if (!leadCompanyId && finalTeleAgentId) {
    const teleUser = await findUserCompanyId(finalTeleAgentId);
    leadCompanyId = teleUser?.companyId ?? null;
  }

  const lead = await createManualLeadRecord({
    name,
    phone,
    storeLink: safeStoreLink,
    niche: niche || null,
    classification: classification || "Cold",
    assignedTeleAgentId: finalTeleAgentId,
    createdById: input.user.id,
    source: sourceName,
    status: status || "New",
    companyId: leadCompanyId,
  });

  return { status: "ok" as const, lead };
}

function canUpdateLead(user: LeadUser, lead: any) {
  return (
    lead.assignedTeleAgentId === user.id ||
    lead.assignedSalesAgentId === user.id ||
    user.role === "super_admin" ||
    (user.role === "tele_sales_manager" &&
      (!lead.assignedTeleAgentId || lead.teleAgent?.directManagerId === user.id)) ||
    (user.role === "sales_manager" && (!lead.assignedSalesAgentId || lead.salesAgent?.directManagerId === user.id))
  );
}

async function applySalesAssigneeChange(user: LeadUser, assignedSalesAgentId: any, updateData: any) {
  if (!["super_admin", "sales_manager"].includes(user.role)) {
    return { status: "sales_reassign_forbidden" as const };
  }

  if (assignedSalesAgentId) {
    const targetSalesAgent = await findLeadAssigneeForUpdate(assignedSalesAgentId);
    if (
      !targetSalesAgent ||
      targetSalesAgent.role !== "sales_agent" ||
      targetSalesAgent.status !== "Active" ||
      (user.role === "sales_manager" && targetSalesAgent.directManagerId !== user.id)
    ) {
      return { status: "invalid_sales_assignee" as const };
    }
  }

  updateData.assignedSalesAgentId = assignedSalesAgentId;
  return { status: "ok" as const };
}

async function applyTeleAssigneeChange(user: LeadUser, assignedTeleAgentId: any, updateData: any) {
  if (!["super_admin", "tele_sales_manager"].includes(user.role)) {
    return { status: "tele_reassign_forbidden" as const };
  }

  if (assignedTeleAgentId) {
    const targetTeleAgent = await findLeadAssigneeForUpdate(assignedTeleAgentId);
    if (
      !targetTeleAgent ||
      targetTeleAgent.role !== "tele_sales_agent" ||
      targetTeleAgent.status !== "Active" ||
      (user.role === "tele_sales_manager" && targetTeleAgent.directManagerId !== user.id)
    ) {
      return { status: "invalid_tele_assignee" as const };
    }
  }

  updateData.assignedTeleAgentId = assignedTeleAgentId;
  return { status: "ok" as const };
}

function buildLeadUpdateData(body: any) {
  const updateData: any = {};

  if (body.status) updateData.status = body.status;
  if (body.followUpDate !== undefined) updateData.followUpDate = new Date(body.followUpDate);
  if (body.meetingDate !== undefined) updateData.meetingDate = new Date(body.meetingDate + "T00:00:00Z");
  if (body.meetingTime !== undefined) updateData.meetingTime = body.meetingTime;
  if (body.meetingStartedAt !== undefined) {
    updateData.meetingStartedAt = body.meetingStartedAt === null ? null : new Date(body.meetingStartedAt);
  }
  if (body.meetingEndedAt !== undefined) {
    updateData.meetingEndedAt = body.meetingEndedAt === null ? null : new Date(body.meetingEndedAt);
  }
  if (body.hasStore !== undefined) updateData.hasStore = body.hasStore;
  if (body.customerType !== undefined) updateData.customerType = body.customerType;
  if (body.archived) updateData.archivedAt = new Date();
  if (body.incrementRecycle) updateData.recycleCount = { increment: 1 };

  return updateData;
}

async function syncLeadNotes(input: {
  leadId: string;
  userId: string;
  status?: string;
  notes: string;
  meetingDate?: string;
  meetingTime?: string;
}) {
  await createLeadCallLog({
    leadId: input.leadId,
    agentId: input.userId,
    callStatus: input.status || "Updated",
    notes: input.notes,
  });

  const latestMeeting = await findLatestLeadMeeting(input.leadId);
  if (!latestMeeting) return;

  let meetingStatus: string | null = null;
  if (input.status === "Closed_Won") meetingStatus = "Won";
  else if (input.status === "Closed_Lost") meetingStatus = "Lost";
  else if (input.status === "Rescheduled") meetingStatus = "Scheduled";
  else if (input.status === "Follow_Up") meetingStatus = "Attended";
  else if (!input.status && latestMeeting.status === "Scheduled") {
    meetingStatus = "Attended";
  }

  if (meetingStatus) {
    await updateLeadMeeting(latestMeeting.id, {
      status: meetingStatus,
      salesNotes: input.notes,
      ...(input.meetingDate
        ? { meetingDate: new Date(input.meetingDate + "T" + (input.meetingTime || "00:00") + ":00Z") }
        : {}),
      ...(input.meetingTime ? { meetingTime: input.meetingTime } : {}),
    });
  }
}

export async function updateLead(input: { id: string; user: LeadUser; body: any }) {
  const existingLead = await findLeadForUpdate(input.id);
  if (!existingLead) {
    return { status: "not_found" as const };
  }

  if (!canUpdateLead(input.user, existingLead)) {
    return { status: "forbidden" as const };
  }

  const updateData = buildLeadUpdateData(input.body);

  if (input.body.assignedSalesAgentId !== undefined) {
    const result = await applySalesAssigneeChange(input.user, input.body.assignedSalesAgentId, updateData);
    if (result.status !== "ok") return result;
  }

  if (input.body.assignedTeleAgentId !== undefined) {
    const result = await applyTeleAssigneeChange(input.user, input.body.assignedTeleAgentId, updateData);
    if (result.status !== "ok") return result;
  }

  if (input.body.storeLink !== undefined) {
    if (input.body.storeLink === null || input.body.storeLink === "") {
      updateData.storeLink = null;
    } else {
      const safeStoreLink = normalizeWebUrl(input.body.storeLink);
      if (!safeStoreLink) {
        return { status: "invalid_store_link" as const };
      }
      updateData.storeLink = safeStoreLink;
    }
  }

  const lead = await updateLeadRecord(input.id, updateData);

  if (input.body.notes) {
    await syncLeadNotes({
      leadId: input.id,
      userId: input.user.id,
      status: input.body.status,
      notes: input.body.notes,
      meetingDate: input.body.meetingDate,
      meetingTime: input.body.meetingTime,
    });
  }

  if (input.body.assignedSalesAgentId) {
    await createLeadNotification({
      userId: input.body.assignedSalesAgentId,
      title: "New Lead Assigned",
      message: "A lead has been assigned to your queue.",
      link: "/dashboard/sales",
    });
  }

  if (input.body.assignedTeleAgentId) {
    await createLeadNotification({
      userId: input.body.assignedTeleAgentId,
      title: "Recycled Lead Assigned",
      message: "A recycled lead has been assigned to you for follow-up.",
      link: "/dashboard/telesales",
    });
  }

  return { status: "ok" as const, lead };
}

export async function deleteLead(input: { id: string; user: LeadUser }) {
  const lead = await findLeadForDelete(input.id);
  if (!lead) {
    return { status: "not_found" as const };
  }

  if (
    input.user.role === "tele_sales_manager" &&
    lead.assignedTeleAgentId &&
    lead.teleAgent?.directManagerId !== input.user.id
  ) {
    return { status: "delete_forbidden" as const };
  }

  await deleteLeadRecord(input.id);
  return { status: "ok" as const };
}

export async function distributeLeadMeeting(input: { id: string; user: LeadUser }) {
  const lead = await findLeadForMeetingDistribution(input.id);
  if (!lead) {
    return { status: "not_found" as const };
  }

  const isAuthorized =
    lead.assignedTeleAgentId === input.user.id ||
    input.user.role === "super_admin" ||
    (input.user.role === "tele_sales_manager" &&
      (!lead.assignedTeleAgentId || lead.teleAgent?.directManagerId === input.user.id));

  if (!isAuthorized) {
    return { status: "forbidden" as const };
  }

  const latestMeeting = lead.meetings[0];
  if (!latestMeeting || !lead.meetingDate) {
    return { status: "no_booked_meeting" as const };
  }

  if (!canManuallyDistributeMeeting(lead)) {
    return { status: "not_ready" as const };
  }

  if (lead.assignedSalesAgentId || latestMeeting.salesAgentId) {
    return { status: "already_distributed" as const };
  }

  const result = await autoAssignLead(input.id);
  if (!result.assigned) {
    return { status: "auto_assign_failed" as const, result };
  }

  const leadAfterDistribution = await findDistributedLead(input.id);
  return { status: "ok" as const, result, lead: leadAfterDistribution };
}

function buildDraftScope(user: LeadUser) {
  if (user.role === "tele_sales_agent") {
    return { OR: [{ createdById: user.id }, { assignedTeleAgentId: user.id }] };
  }

  if (user.role === "tele_sales_manager") {
    return {
      OR: [
        { createdById: user.id },
        { assignedTeleAgentId: null },
        { teleAgent: { is: { directManagerId: user.id } } },
      ],
    };
  }

  return {};
}

export async function bulkPromoteLeads(input: { user: LeadUser; body: any }) {
  const { leadIds } = input.body;
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return { status: "no_leads_selected" as const };
  }

  const draftLeads = await findDraftLeadsForBulk({
    leadIds,
    draftScope: buildDraftScope(input.user),
  });
  const draftPhones = draftLeads.map((lead) => lead.phone);

  const existingDuplicates = await findActiveLeadPhones(draftPhones);
  const duplicatePhones = existingDuplicates.map((lead) => lead.phone);
  const validLeadIdsToPromote = draftLeads
    .filter((lead) => !duplicatePhones.includes(lead.phone))
    .map((lead) => lead.id);

  if (validLeadIdsToPromote.length > 0) {
    await promoteDraftLeads({
      leadIds: validLeadIdsToPromote,
      assignedTeleAgentId: input.user.id,
    });
  }

  if (duplicatePhones.length > 0 && validLeadIdsToPromote.length === 0) {
    return { status: "all_duplicates" as const };
  }

  let message = `Successfully promoted ${validLeadIdsToPromote.length} to Active Leads!`;
  if (duplicatePhones.length > 0) {
    message += ` (Skipped ${duplicatePhones.length} because their phone number already exists)`;
  }

  return {
    status: "ok" as const,
    promotedCount: validLeadIdsToPromote.length,
    message,
  };
}

export async function bulkDeleteLeads(input: { user: LeadUser; body: any }) {
  const { leadIds } = input.body;
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return { status: "no_leads_selected" as const };
  }

  const result = await deleteDraftLeads({
    leadIds,
    draftScope: buildDraftScope(input.user),
  });

  return { status: "ok" as const, deletedCount: result.count };
}

export async function importLeadsFromExcel(input: {
  user: LeadUser;
  file: File | null;
  assignToAgentId: string | null;
  companyId?: string | null;
}) {
  if (!input.file) {
    return { status: "no_file" as const };
  }

  if (input.assignToAgentId) {
    const targetAgent = await findLeadAssigneeForManualCreate(input.assignToAgentId);
    const invalidForSuperAdmin =
      input.user.role === "super_admin" &&
      (!targetAgent || targetAgent.role !== "tele_sales_agent" || targetAgent.status !== "Active");
    const invalidForManager =
      input.user.role === "tele_sales_manager" &&
      (!targetAgent ||
        targetAgent.role !== "tele_sales_agent" ||
        targetAgent.status !== "Active" ||
        targetAgent.directManagerId !== input.user.id);

    if (invalidForSuperAdmin || invalidForManager) {
      return { status: "invalid_tele_assignee" as const };
    }
  }

  const arrayBuffer = await input.file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rawRows.length === 0) {
    return { status: "empty_file" as const };
  }

  const excelHeaders = Object.keys(rawRows[0]);
  const fieldMapping: Record<string, string> = {};
  for (const header of excelHeaders) {
    const normalized = normalizeImportHeader(header);
    if (IMPORT_COLUMN_MAP[normalized]) {
      fieldMapping[header] = IMPORT_COLUMN_MAP[normalized];
    }
  }

  const mappedFields = Object.values(fieldMapping);
  if (!mappedFields.includes("name") || !mappedFields.includes("phone")) {
    return { status: "missing_required_columns" as const, detectedHeaders: excelHeaders };
  }

  const existingLeads = await findExistingLeadPhones();
  const existingPhones = new Set(existingLeads.map((lead) => lead.phone));

  let hotAgents: { id: string; specialization: string | null }[] = [];
  let coldAgents: { id: string; specialization: string | null }[] = [];
  let hotIndex = 0;
  let coldIndex = 0;

  if (!input.assignToAgentId) {
    const allAgents = await findActiveTeleSalesAgents();
    hotAgents = allAgents.filter((agent) => agent.specialization === "Hot");
    coldAgents = allAgents.filter(
      (agent) => agent.specialization === "Cold" || agent.specialization === "Warm" || !agent.specialization
    );
    if (hotAgents.length === 0) hotAgents = [...coldAgents];
    if (coldAgents.length === 0) coldAgents = [...hotAgents];
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const agentAssignCounts: Record<string, number> = {};

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 2;

    try {
      const mapped: Record<string, string> = {};
      for (const [excelColumn, fieldName] of Object.entries(fieldMapping)) {
        mapped[fieldName] = String(row[excelColumn] ?? "").trim();
      }

      const name = mapped.name;
      const phone = cleanImportPhone(mapped.phone);
      if (!name || !phone) {
        errors.push(`Row ${rowNum}: Missing name or phone`);
        continue;
      }

      if (existingPhones.has(phone)) {
        skipped++;
        continue;
      }

      const classification = mapped.classification ? normalizeImportClassification(mapped.classification) : "Cold";
      let finalAgentId = input.assignToAgentId;

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

      await createImportedLead({
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
        companyId: input.companyId || null,
      });

      if (finalAgentId && !input.assignToAgentId) {
        agentAssignCounts[finalAgentId] = (agentAssignCounts[finalAgentId] || 0) + 1;
      }

      existingPhones.add(phone);
      imported++;
    } catch (rowError) {
      errors.push(`Row ${rowNum}: ${(rowError as Error).message}`);
    }
  }

  if (input.assignToAgentId && imported > 0) {
    await createLeadNotification({
      userId: input.assignToAgentId,
      title: "New Leads Assigned",
      message: `You have been assigned ${imported} new leads from the latest Excel import.`,
      link: "/dashboard/telesales",
    });
  } else if (!input.assignToAgentId && Object.keys(agentAssignCounts).length > 0) {
    for (const [agentId, count] of Object.entries(agentAssignCounts)) {
      await createLeadNotification({
        userId: agentId,
        title: "New Leads Auto-Assigned",
        message: `You have been automatically assigned ${count} new leads from the latest Excel import.`,
        link: "/dashboard/telesales",
      });
    }
  }

  return {
    status: "ok" as const,
    imported,
    skipped,
    totalRows: rawRows.length,
    errors: errors.slice(0, 20),
  };
}
