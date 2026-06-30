import { prisma } from "./prisma";

/**
 * Sales Meeting Auto-Assignment Engine — sequential round-robin.
 *
 * Meetings are handed out IN ORDER (Sales 1 → Sales 2 → Sales 3 → back to 1…),
 * always to the NEXT agent in the cycle who is currently free. We do NOT load
 * balance: an idle agent does not jump the queue. "Free" means the agent is
 * present at work right now — they have checked in today and have not checked
 * out — and is not manually flagged Busy/In_Call (e.g. while in a call/meeting).
 *
 * Flow:
 * 1. Resolve the company scope (lead's company → tele agent's company).
 * 2. List that company's employed sales agents in a stable cycle order.
 * 3. Mark each agent available/unavailable from today's attendance + status.
 * 4. Find who got the most recent meeting and continue the rotation after them.
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
 * Sequential round-robin pick. Starting from the position AFTER the agent who
 * received the most recent meeting, walks the fixed cycle forward and returns
 * the first AVAILABLE agent. Skipped (busy/absent) agents are simply passed
 * over — and reconsidered next time their turn comes back around. Returns null
 * when nobody in the cycle is currently available.
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

  // 3. An agent is available when present AND not flagged Busy / In_Call.
  const rotation: RotationAgent[] = agents.map((a) => ({
    id: a.id,
    order: a.createdAt.getTime(),
    available:
      isAgentPresent(attendanceByUser.get(a.id)) && a.status !== "Busy" && a.status !== "In_Call",
  }));

  // 4. Continue the rotation after whoever received the most recent meeting.
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
