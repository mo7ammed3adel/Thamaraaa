import { prisma } from "./prisma";

/**
 * Smart Auto-Assignment Engine
 * 
 * Flow:
 * 1. Filter AVAILABLE sales agents (Active only, exclude Busy & In_Call)
 * 2. Match by specialization (Hot→Hot, Warm→Warm, Cold→Cold)
 * 3. Fallback by level (Senior/Mid for Hot, Junior/Mid for Cold/Warm)
 * 4. Hard fallback: all available agents
 * 5. Load balance: pick agent with fewest active In_Sales leads
 * 6. Assign lead + update meeting + create notification
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

export type DistributableAgent = {
  id: string;
  specialization?: string | null;
  /** Active (In_Sales) leads currently held by the agent. */
  activeLeads: number;
  /** Total meetings ever assigned to the agent. */
  meetings: number;
};

/** True when the agent's specialization fits the lead classification. */
function specializationFits(agent: DistributableAgent, classification: string): boolean {
  const s = (agent.specialization || "").toLowerCase();
  if (classification === "Hot") return s === "hot";
  if (classification === "Warm") return s === "warm";
  return s === "cold" || s === "warm";
}

/**
 * Picks the sales agent who should receive the next meeting. Priority:
 *   1) fewest active leads, 2) fewest meetings (agents with NO meetings first),
 *   3) matching specialization as a tiebreaker.
 * Every eligible agent stays in the pool — specialization never narrows it down
 * to a single agent, so meetings spread to whoever is least busy.
 */
export function chooseSalesAgent(
  agents: DistributableAgent[],
  classification: string
): DistributableAgent | null {
  if (agents.length === 0) return null;
  return [...agents].sort((a, b) => {
    if (a.activeLeads !== b.activeLeads) return a.activeLeads - b.activeLeads;
    if (a.meetings !== b.meetings) return a.meetings - b.meetings;
    const aFit = specializationFits(a, classification) ? 0 : 1;
    const bFit = specializationFits(b, classification) ? 0 : 1;
    return aFit - bFit;
  })[0];
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

  // 1. Get all AVAILABLE sales agents (exclude Busy and In_Call).
  //    When the lead has a company, only that company's agents are eligible —
  //    distribution stays inside the company (same load-balancing logic).
  const agents = await prisma.user.findMany({
    where: {
      role: "sales_agent",
      status: { notIn: ["Busy", "In_Call", "Inactive"] },
      ...(companyId ? { companyId } : {}),
    },
    include: {
      salesLeads: {
        where: { status: "In_Sales" },
        select: { id: true },
      },
      _count: {
        select: { meetingsAsSales: true },
      },
    },
  });

  if (agents.length === 0) {
    // No agents available at all — put lead in waiting queue
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "Waiting" },
    });
    return { assigned: false, reason: "no_available_sales_agents" };
  }

  // 2 + 3. Load-balanced selection across the whole eligible pool — spread to
  //        the least-busy agent (fewest active leads, then fewest meetings),
  //        with specialization only as a tiebreaker so it never narrows the
  //        pool down to a single agent.
  const classification = lead.classification || "Cold";
  const chosen = chooseSalesAgent(
    agents.map((a) => ({
      id: a.id,
      specialization: a.specialization,
      activeLeads: a.salesLeads.length,
      meetings: a._count.meetingsAsSales,
    })),
    classification
  );
  const chosenAgent = agents.find((a) => a.id === chosen!.id)!;

  // 4. Assign lead to chosen agent
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      assignedSalesAgentId: chosenAgent.id,
      status: "In_Sales",
    },
  });

  // 5. Update the meeting record to include the assigned sales agent
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

  // 6. Create notification for the assigned sales agent
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
