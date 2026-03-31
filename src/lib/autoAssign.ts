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
export async function autoAssignLead(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  // 1. Get all AVAILABLE sales agents (exclude Busy and In_Call)
  const agents = await prisma.user.findMany({
    where: {
      role: "sales_agent",
      status: { notIn: ["Busy", "In_Call", "Inactive"] },
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
    return;
  }

  // 2. Match by specialization
  let eligibleAgents = agents;
  const classification = lead.classification || "Cold";

  if (classification === "Hot") {
    // Hot leads → Hot agents first → Senior/Mid fallback → all agents
    const hotAgents = agents.filter((a) => a.specialization === "Hot");
    if (hotAgents.length > 0) {
      eligibleAgents = hotAgents;
    } else {
      const seniorAgents = agents.filter(
        (a) => a.level === "Senior" || a.level === "Mid"
      );
      eligibleAgents = seniorAgents.length > 0 ? seniorAgents : agents;
    }
  } else if (classification === "Warm") {
    // Warm leads → Warm agents first → Hot/Cold fallback → all agents
    const warmAgents = agents.filter((a) => a.specialization === "Warm");
    if (warmAgents.length > 0) {
      eligibleAgents = warmAgents;
    } else {
      const midAgents = agents.filter(
        (a) => a.level === "Mid" || a.level === "Senior"
      );
      eligibleAgents = midAgents.length > 0 ? midAgents : agents;
    }
  } else {
    // Cold leads → Cold agents first → Warm fallback → Junior/Mid → all agents
    const coldAgents = agents.filter(
      (a) => a.specialization === "Cold" || a.specialization === "Warm"
    );
    if (coldAgents.length > 0) {
      eligibleAgents = coldAgents;
    } else {
      const juniorAgents = agents.filter(
        (a) => a.level === "Junior" || a.level === "Mid"
      );
      eligibleAgents = juniorAgents.length > 0 ? juniorAgents : agents;
    }
  }

  // 3. Load balancing — sort by fewest active leads (In_Sales), then by fewest total meetings
  eligibleAgents.sort((a, b) => {
    const leadDiff = a.salesLeads.length - b.salesLeads.length;
    if (leadDiff !== 0) return leadDiff;
    return a._count.meetingsAsSales - b._count.meetingsAsSales;
  });

  const chosenAgent = eligibleAgents[0];

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
}
