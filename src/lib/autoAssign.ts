import { prisma } from "./prisma";

export async function autoAssignLead(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  // 1. Filter online sales agents
  // Since we don't have real "online" presence yet, we just filter by role and "Available"
  const agents = await prisma.user.findMany({
    where: {
      role: "sales_agent",
      status: "Active", // For now assume Active means available, a real status toggle comes later
    },
    include: {
      salesDeals: true,
      salesLeads: {
        where: {
          status: "In_Sales"
        }
      }
    }
  });

  // 2. Match specialization
  let eligibleAgents = agents;
  const hotAgents = agents.filter(a => a.specialization === "Hot");
  const coldAgents = agents.filter(a => a.specialization === "Cold" || a.specialization === "Warm" || !a.specialization);

  if (lead.classification === "Hot") {
    if (hotAgents.length > 0) {
      eligibleAgents = hotAgents;
    } else {
      eligibleAgents = agents.filter(a => a.level === "Senior" || a.level === "Mid");
    }
  } else {
    // Warm or Cold
    if (coldAgents.length > 0) {
      eligibleAgents = coldAgents;
    } else {
      eligibleAgents = agents.filter(a => a.level === "Junior" || a.level === "Mid");
    }
  }
  
  // Hard fallback just in case 
  if (eligibleAgents.length === 0 && agents.length > 0) {
    eligibleAgents = agents;
  }

  if (eligibleAgents.length === 0) {
    // If no specific agent, fallback to queue
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "Waiting" }
    });
    return;
  }

  // 3. Load balancing: fewest meetings/leads currently in progress today
  eligibleAgents.sort((a, b) => a.salesLeads.length - b.salesLeads.length);
  const chosenAgent = eligibleAgents[0];

  // 4. Assign
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      assignedSalesAgentId: chosenAgent.id,
      status: "In_Sales",
    }
  });

  // Here we would use Pusher to notify the chosen agent
  // await pusherServer.trigger('sales-queue', 'new-lead', { agentId: chosenAgent.id, leadId });
}
