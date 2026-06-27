import { resolveManualLeadAssigneeId } from "@/lib/manualLeadAssignment";
import { autoAssignLead } from "@/lib/autoAssign";
import { canManuallyDistributeMeeting } from "@/lib/meetingDistribution";
import { normalizeWebUrl } from "@/lib/safe-url";
import {
  createLeadCallLog,
  createLeadNotification,
  createManualLeadRecord,
  deleteLeadRecord,
  deleteDraftLeads,
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

export async function createManualLead(input: { user: LeadUser; body: any }) {
  const { name, phone, storeLink, niche, classification, assignedTeleAgentId, status } = input.body;

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
