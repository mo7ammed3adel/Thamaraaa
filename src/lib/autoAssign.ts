import { prisma } from "./prisma";

/**
 * Sales Meeting Auto-Assignment Engine — sequential round-robin with skip-busy.
 *
 * Meetings are shared across ALL agents in turn (Sales 1 → 2 → 3 → back to 1 …).
 * No agent is prioritised. Each new meeting goes to the next agent in the cycle
 * after whoever received the previous one. If that agent is busy — currently
 * INSIDE a started meeting (Start Task done, not finished), flagged Busy, or
 * absent — their turn is skipped and the meeting flows to the next available
 * agent; they are reconsidered when the rotation comes back around.
 *
 * "Available" means present at work (checked in, not out), not flagged Busy,
 * and not currently inside a started meeting. Being merely assigned an un-started
 * meeting does NOT make an agent unavailable.
 *
 * Flow:
 * 1. Resolve the company scope (lead's company → tele agent's company).
 * 2. List that company's employed sales agents in a stable cycle order.
 * 3. Mark each agent available/unavailable from attendance + status + whether
 *    they are currently inside a started (un-finished) meeting.
 * 4. Continue the rotation after whoever received the most recent meeting,
 *    skipping unavailable agents.
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
 * An agent can receive a meeting this round when they are present at work, not
 * flagged Busy, and not currently inside a started meeting (Start Task done, not
 * yet finished). Being merely assigned an un-started meeting does not block them.
 */
export function isAgentAvailableForMeeting(input: {
  present: boolean;
  status: string | null;
  inStartedMeeting: boolean;
}): boolean {
  return (
    input.present &&
    input.status !== "Busy" &&
    input.status !== "In_Call" &&
    !input.inStartedMeeting
  );
}

/**
 * Sequential round-robin pick. Starting from the position AFTER the agent who
 * received the most recent meeting, walks the fixed cycle forward and returns
 * the first AVAILABLE agent. Busy/absent agents are skipped for this round and
 * reconsidered when their turn comes back around. Returns null when nobody in
 * the cycle is currently available.
 */
export function chooseNextAgentRoundRobin(
  agents: RotationAgent[],
  lastAssignedAgentId: string | null
): RotationAgent | null {
  if (agents.length === 0) return null;
  const ordered = [...agents].sort((a, b) =>
    a.order !== b.order ? a.order - b.order : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  const n = ordered.length;
  const lastIdx = lastAssignedAgentId ? ordered.findIndex((a) => a.id === lastAssignedAgentId) : -1;
  for (let step = 1; step <= n; step++) {
    const candidate = ordered[(((lastIdx + step) % n) + n) % n];
    if (candidate.available) return candidate;
  }
  return null;
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

  // 3. Agents currently INSIDE a started meeting (Start Task done, not finished)
  //    are skipped until they finish. An un-started assigned meeting does NOT
  //    block them — Sales 1 stays first in line until they actually start one.
  const inMeetingLeads = await prisma.lead.findMany({
    where: {
      assignedSalesAgentId: { in: agentIds },
      meetingStartedAt: { not: null },
      meetingEndedAt: null,
    },
    select: { assignedSalesAgentId: true },
  });
  const inMeetingAgentIds = new Set(inMeetingLeads.map((l) => l.assignedSalesAgentId));

  // An agent is available when present, not Busy/In_Call, and not inside a
  // started meeting.
  const rotation: RotationAgent[] = agents.map((a) => ({
    id: a.id,
    order: a.createdAt.getTime(),
    available: isAgentAvailableForMeeting({
      present: isAgentPresent(attendanceByUser.get(a.id)),
      status: a.status,
      inStartedMeeting: inMeetingAgentIds.has(a.id),
    }),
  }));

  // 4. Continue the rotation after whoever received the most recent meeting,
  //    skipping anyone currently busy/absent.
  const lastMeeting = await prisma.meeting.findFirst({
    where: { salesAgentId: { in: agentIds } },
    orderBy: { createdAt: "desc" },
    select: { salesAgentId: true },
  });
  const chosen = chooseNextAgentRoundRobin(rotation, lastMeeting?.salesAgentId ?? null);

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
