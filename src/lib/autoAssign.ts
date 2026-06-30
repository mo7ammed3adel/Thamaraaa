import { prisma } from "./prisma";

/**
 * Sales Meeting Auto-Assignment Engine — priority order (NOT round-robin).
 *
 * Meetings always go to the FIRST available agent in a fixed order (Sales 1
 * first, then Sales 2, then Sales 3…). Earlier agents are preferred whenever
 * they are free: a later agent only receives a meeting when everyone ahead of
 * them is currently busy or absent. This is intentionally NOT equal/round-robin
 * distribution — Sales 1 keeps getting meetings as long as they are free.
 *
 * "Available" means the agent is present at work right now — they have checked
 * in today and have not checked out — is not flagged Busy/In_Call, AND is not
 * already holding an open meeting. An agent holds a meeting from the moment it
 * is routed to them until they close it (Won/Lost/Follow-up/Reschedule). This
 * "one open meeting at a time" rule is what stops every meeting from piling onto
 * the first agent: once Sales 1 is handed a meeting they are busy, so the next
 * flows to Sales 2; when Sales 1 closes theirs they are first in line again.
 *
 * Flow:
 * 1. Resolve the company scope (lead's company → tele agent's company).
 * 2. List that company's employed sales agents in a stable priority order.
 * 3. Mark each agent available/unavailable from attendance + status + whether
 *    they already hold an open (In_Sales) meeting.
 * 4. Pick the first available agent in order.
 * 5. Assign lead + update meeting + notify. If nobody is free → Waiting queue.
 */
export type AutoAssignLeadResult =
  | { assigned: true; salesAgent: { id: string; name: string } }
  | { assigned: false; reason: "lead_not_found" | "no_available_sales_agents" };

/**
 * The company whose Sales agents may receive a lead: the lead's own company,
 * else the company of its assigned telesales agent. Returns null only when
 * neither is known (then distribution is org-wide). This guarantees a tele
 * agent in Company A can never hand a lead to Sales in another company.
 */
export function resolveDistributionCompanyId(
  lead: { companyId?: string | null; assignedTeleAgentId?: string | null },
  teleAgentCompanyId?: string | null
): string | null {
  if (lead.companyId) return lead.companyId;
  if (lead.assignedTeleAgentId) return teleAgentCompanyId ?? null;
  return null;
}

export type RotationAgent = {
  id: string;
  /** Stable cycle position (lower = earlier). Typically hire/creation time in ms. */
  order: number;
  /** Whether the agent can receive a meeting right now (present and not busy). */
  available: boolean;
};

/** Present = clocked in for the day and not yet clocked out. */
export function isAgentPresent(
  attendance: { checkIn: Date | null; checkOut: Date | null } | null | undefined
): boolean {
  return Boolean(attendance && attendance.checkIn && !attendance.checkOut);
}

/**
 * An agent can receive a NEW meeting only when they are present at work, not
 * flagged Busy/In_Call, AND not already holding an open meeting. The last
 * condition — one open meeting at a time — is what prevents every meeting from
 * piling onto the first agent in the order: a handed-out meeting keeps its agent
 * busy until it is closed, so the next meeting flows to the next free agent.
 */
export function isAgentAvailableForMeeting(input: {
  present: boolean;
  status: string | null;
  holdingOpenMeeting: boolean;
}): boolean {
  return (
    input.present &&
    input.status !== "Busy" &&
    input.status !== "In_Call" &&
    !input.holdingOpenMeeting
  );
}

/**
 * Priority-order pick. Walks the fixed order from the top (Sales 1 → 2 → 3 …)
 * and returns the FIRST agent who is currently available. Earlier agents are
 * always preferred — a later agent only gets a meeting when everyone ahead of
 * them is busy/absent. Returns null when nobody is available.
 */
export function chooseFirstAvailableByOrder(agents: RotationAgent[]): RotationAgent | null {
  if (agents.length === 0) return null;
  const ordered = [...agents].sort((a, b) =>
    a.order !== b.order ? a.order - b.order : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  return ordered.find((a) => a.available) ?? null;
}

export async function autoAssignLead(leadId: string): Promise<AutoAssignLeadResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { assigned: false, reason: "lead_not_found" };

  // The lead's company governs distribution. If it wasn't set explicitly, fall back
  // to the assigned telesales agent's company — so a tele agent in Company A can
  // never hand a lead to a Sales agent in a different company.
  let teleAgentCompanyId: string | null = null;
  if (!lead.companyId && lead.assignedTeleAgentId) {
    const teleAgent = await prisma.user.findUnique({
      where: { id: lead.assignedTeleAgentId },
      select: { companyId: true },
    });
    teleAgentCompanyId = teleAgent?.companyId ?? null;
  }
  const companyId = resolveDistributionCompanyId(lead, teleAgentCompanyId);

  // 1. The cycle: every employed sales agent in scope (exclude soft-deleted /
  //    terminated). Absent agents stay in the list so the rotation order is
  //    stable — they are just marked unavailable below.
  const agents = await prisma.user.findMany({
    where: {
      role: "sales_agent",
      status: { not: "Inactive" },
      ...(companyId ? { companyId } : {}),
    },
    select: { id: true, name: true, status: true, createdAt: true },
  });

  if (agents.length === 0) {
    // No agents in scope at all — put lead in waiting queue.
    await prisma.lead.update({ where: { id: leadId }, data: { status: "Waiting" } });
    return { assigned: false, reason: "no_available_sales_agents" };
  }

  const agentIds = agents.map((a) => a.id);

  // 2. Presence from today's attendance: checked in and not yet checked out.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const attendance = await prisma.attendance.findMany({
    where: { userId: { in: agentIds }, date: { gte: startOfToday } },
    select: { userId: true, checkIn: true, checkOut: true },
    orderBy: { date: "asc" },
  });
  const attendanceByUser = new Map<string, { checkIn: Date | null; checkOut: Date | null }>();
  for (const a of attendance) attendanceByUser.set(a.userId, a); // latest wins

  // 3. Agents already holding an open (In_Sales) meeting are busy until they
  //    close it — this is what stops every meeting piling onto the first agent.
  const heldOpenLeads = await prisma.lead.findMany({
    where: { assignedSalesAgentId: { in: agentIds }, status: "In_Sales" },
    select: { assignedSalesAgentId: true },
  });
  const holdingAgentIds = new Set(heldOpenLeads.map((l) => l.assignedSalesAgentId));

  // An agent is available when present, not Busy/In_Call, and not already
  // holding an open meeting.
  const rotation: RotationAgent[] = agents.map((a) => ({
    id: a.id,
    order: a.createdAt.getTime(),
    available: isAgentAvailableForMeeting({
      present: isAgentPresent(attendanceByUser.get(a.id)),
      status: a.status,
      holdingOpenMeeting: holdingAgentIds.has(a.id),
    }),
  }));

  // 4. Pick the first available agent in priority order (Sales 1 first).
  const chosen = chooseFirstAvailableByOrder(rotation);

  if (!chosen) {
    // Everyone is checked out / absent / busy — hold the lead for a retry.
    await prisma.lead.update({ where: { id: leadId }, data: { status: "Waiting" } });
    return { assigned: false, reason: "no_available_sales_agents" };
  }
  const classification = lead.classification || "Cold";
  const chosenAgent = agents.find((a) => a.id === chosen.id)!;

  // 5. Assign lead to chosen agent
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      assignedSalesAgentId: chosenAgent.id,
      status: "In_Sales",
    },
  });

  // 6. Update the meeting record to include the assigned sales agent
  const latestMeeting = await prisma.meeting.findFirst({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });
  if (latestMeeting && !latestMeeting.salesAgentId) {
    await prisma.meeting.update({
      where: { id: latestMeeting.id },
      data: { salesAgentId: chosenAgent.id },
    });
  }

  // 7. Create notification for the assigned sales agent
  try {
    await prisma.notification.create({
      data: {
        userId: chosenAgent.id,
        title: "New Lead Assigned",
        message: `Lead "${lead.name}" (${classification}) has been assigned to you. Meeting scheduled.`,
        type: "lead_assigned",
      },
    });
  } catch (e) {
    // Notification creation failure should not break the assignment
    console.error("Failed to create notification:", e);
  }

  return {
    assigned: true,
    salesAgent: { id: chosenAgent.id, name: chosenAgent.name },
  };
}
