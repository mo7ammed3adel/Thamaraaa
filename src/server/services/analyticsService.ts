import {
  countSalesAgentLeads,
  countTeleSalesAgentLeads,
  countTeleSalesAgentMeetings,
  countChiefSalesLeads,
  findAnalyticsAgentForAccess,
  findAnalyticsAgents,
  findChiefSalesDeals,
  findChiefSalesMeetings,
  findChiefSalesSalesPerformance,
  findChiefSalesTeleSalesPerformance,
  findChiefSalesWarnings,
  findSalesAgentDeals,
  findSalesAgentLeads,
  findSalesAgentMeetings,
  findSalesAgentProgressDeals,
  findSalesAgentProgressMeetings,
  findSalesDrillDeals,
  findSalesDrillLeads,
  findSalesDrillMeetings,
  findSalesTeamDeals,
  findSalesTeamLeads,
  findSalesTeamMeetings,
  findTeleSalesAgentCallLogs,
  findTeleSalesAgentDeals,
  findTeleSalesAgentMeetings,
  findTeleSalesAgentProgressCallLogs,
  findTeleSalesDrillCallLogs,
  findTeleSalesDrillDeals,
  findTeleSalesDrillMeetings,
  findTeleSalesTeamCallLogs,
  findTeleSalesTeamDeals,
  findTeleSalesTeamMeetings,
} from "@/server/repositories/analyticsRepository";

type DateRangeParams = {
  from?: string | null;
  to?: string | null;
};

type Requester = {
  id: string;
  role?: string | null;
};

function buildDateFilter(input: DateRangeParams) {
  const dateFilter: any = {};
  if (input.from) dateFilter.gte = new Date(input.from);
  if (input.to) {
    const toDate = new Date(input.to);
    toDate.setHours(23, 59, 59, 999);
    dateFilter.lte = toDate;
  }

  return input.from || input.to ? dateFilter : null;
}

function buildCreatedAtFilter(input: DateRangeParams) {
  const dateFilter = buildDateFilter(input);
  return dateFilter ? { createdAt: dateFilter } : {};
}

function buildMeetingDateFilter(input: DateRangeParams) {
  const dateFilter = buildDateFilter(input);
  return dateFilter ? { meetingDate: dateFilter } : {};
}

async function getTeamAgentIds(input: {
  requester: Requester;
  agentRole: "tele_sales_agent" | "sales_agent";
  managerRole: "tele_sales_manager" | "sales_manager";
}) {
  const agents = await findAnalyticsAgents({
    role: input.agentRole,
    managerRole: input.requester.role || "",
    managerId: input.requester.id,
    managerScopedRole: input.managerRole,
  });

  return { agents, agentIds: agents.map((agent) => agent.id) };
}

function stripAgentAccessFields(agent: any) {
  const { role: _agentRole, directManagerId: _directManagerId, ...safeAgent } = agent;
  return safeAgent;
}

async function getAccessibleAgent(input: {
  requester: Requester;
  agentId: string;
  expectedRole: "tele_sales_agent" | "sales_agent";
  managerRole: "tele_sales_manager" | "sales_manager";
}) {
  const agent = await findAnalyticsAgentForAccess(input.agentId);
  if (!agent || agent.role !== input.expectedRole) {
    return { status: "not_found" as const };
  }

  if (input.requester.role === input.managerRole && agent.directManagerId !== input.requester.id) {
    return { status: "forbidden" as const };
  }

  return { status: "ok" as const, agent: stripAgentAccessFields(agent) };
}

export async function getTeleSalesTeamAnalytics(input: Requester & DateRangeParams) {
  const createdAtFilter = buildCreatedAtFilter(input);
  const meetingDateFilter = buildMeetingDateFilter(input);
  const { agents, agentIds } = await getTeamAgentIds({
    requester: input,
    agentRole: "tele_sales_agent",
    managerRole: "tele_sales_manager",
  });

  const [callLogs, meetings, deals] = await Promise.all([
    findTeleSalesTeamCallLogs(agentIds, createdAtFilter),
    findTeleSalesTeamMeetings(agentIds, meetingDateFilter),
    findTeleSalesTeamDeals(agentIds, createdAtFilter),
  ]);

  const analyticsMap: Record<string, any> = {};
  for (const agent of agents) {
    analyticsMap[agent.id] = {
      ...agent,
      totalCalls: 0,
      meetingsBooked: 0,
      meetingsAttended: 0,
      dealsClosed: 0,
      revenue: 0,
    };
  }

  for (const log of callLogs) {
    if (analyticsMap[log.agentId]) {
      analyticsMap[log.agentId].totalCalls++;
      if (log.callStatus === "Accept and book meeting") {
        analyticsMap[log.agentId].meetingsBooked++;
      }
    }
  }

  for (const meeting of meetings) {
    if (analyticsMap[meeting.teleAgentId] && ["Attended", "Won", "Lost"].includes(meeting.status)) {
      analyticsMap[meeting.teleAgentId].meetingsAttended++;
    }
  }

  for (const deal of deals) {
    const agentId = deal.lead?.assignedTeleAgentId;
    if (agentId && analyticsMap[agentId] && deal.status === "Closed_Won") {
      analyticsMap[agentId].dealsClosed++;
      analyticsMap[agentId].revenue += deal.totalAmount || 0;
    }
  }

  return Object.values(analyticsMap);
}

export async function getSalesTeamAnalytics(input: Requester & DateRangeParams) {
  const createdAtFilter = buildCreatedAtFilter(input);
  const { agents, agentIds } = await getTeamAgentIds({
    requester: input,
    agentRole: "sales_agent",
    managerRole: "sales_manager",
  });

  const [leads, meetings, deals] = await Promise.all([
    findSalesTeamLeads(agentIds, createdAtFilter),
    findSalesTeamMeetings(agentIds, createdAtFilter),
    findSalesTeamDeals(agentIds, createdAtFilter),
  ]);

  const analyticsMap: Record<string, any> = {};
  for (const agent of agents) {
    analyticsMap[agent.id] = {
      ...agent,
      totalLeads: 0,
      meetingsAttended: 0,
      dealsWon: 0,
      dealsLost: 0,
      revenue: 0,
    };
  }

  for (const lead of leads) {
    const agentId = lead.assignedSalesAgentId;
    if (agentId && analyticsMap[agentId]) {
      analyticsMap[agentId].totalLeads++;
    }
  }

  for (const meeting of meetings) {
    const agentId = meeting.salesAgentId;
    if (agentId && analyticsMap[agentId] && (meeting.status === "Attended" || meeting.status === "Won")) {
      analyticsMap[agentId].meetingsAttended++;
    }
  }

  for (const deal of deals) {
    const agentId = deal.salesAgentId;
    if (!agentId || !analyticsMap[agentId]) continue;
    if (deal.status === "Closed_Won" || deal.status === "Pending") {
      analyticsMap[agentId].dealsWon++;
      analyticsMap[agentId].revenue += deal.totalAmount || 0;
    } else if (deal.status === "Closed_Lost") {
      analyticsMap[agentId].dealsLost++;
    }
  }

  return Object.values(analyticsMap);
}

export async function getTeleSalesAgentAnalytics(input: Requester & DateRangeParams & { agentId: string }) {
  const access = await getAccessibleAgent({
    requester: input,
    agentId: input.agentId,
    expectedRole: "tele_sales_agent",
    managerRole: "tele_sales_manager",
  });
  if (access.status !== "ok") return access;

  const createdAtFilter = buildCreatedAtFilter(input);
  const [callLogs, meetings, deals] = await Promise.all([
    findTeleSalesAgentCallLogs(input.agentId, createdAtFilter),
    findTeleSalesAgentMeetings(input.agentId, createdAtFilter),
    findTeleSalesAgentDeals(input.agentId, createdAtFilter),
  ]);

  return { status: "ok" as const, data: { agent: access.agent, callLogs, meetings, deals } };
}

export async function getSalesAgentAnalytics(input: Requester & DateRangeParams & { agentId: string }) {
  const access = await getAccessibleAgent({
    requester: input,
    agentId: input.agentId,
    expectedRole: "sales_agent",
    managerRole: "sales_manager",
  });
  if (access.status !== "ok") return access;

  const createdAtFilter = buildCreatedAtFilter(input);
  const [leads, meetings, deals] = await Promise.all([
    findSalesAgentLeads(input.agentId, createdAtFilter),
    findSalesAgentMeetings(input.agentId, createdAtFilter),
    findSalesAgentDeals(input.agentId, createdAtFilter),
  ]);

  return { status: "ok" as const, data: { agent: access.agent, leads, meetings, deals } };
}

export async function getMyProgress(input: Requester & DateRangeParams) {
  const createdAtFilter = buildCreatedAtFilter(input);

  if (input.role === "tele_sales_agent") {
    const [totalLeads, callLogs, meetingsBooked] = await Promise.all([
      countTeleSalesAgentLeads(input.id, createdAtFilter),
      findTeleSalesAgentProgressCallLogs(input.id, createdAtFilter),
      countTeleSalesAgentMeetings(input.id, createdAtFilter),
    ]);

    return {
      status: "ok" as const,
      data: {
        role: "tele_sales_agent",
        totalLeads,
        totalCalls: callLogs.length,
        acceptButLost: callLogs.filter((call) => call.callStatus === "Accept but lost").length,
        acceptAndBook: callLogs.filter((call) => call.callStatus === "Accept and book meeting").length,
        busy: callLogs.filter((call) => call.callStatus === "Busy").length,
        wrongNumber: callLogs.filter((call) => call.callStatus === "Wrong Number").length,
        meetingsBooked,
        callLogs,
      },
    };
  }

  if (input.role === "sales_agent") {
    const [totalLeads, leads, meetings, deals] = await Promise.all([
      countSalesAgentLeads(input.id, createdAtFilter),
      findSalesAgentLeads(input.id, createdAtFilter),
      findSalesAgentProgressMeetings(input.id, createdAtFilter),
      findSalesAgentProgressDeals(input.id, createdAtFilter),
    ]);

    const wonDeals = deals.filter((deal) => deal.status === "Closed_Won" || deal.status === "Pending");

    return {
      status: "ok" as const,
      data: {
        role: "sales_agent",
        totalLeads,
        meetingsAttended: meetings.filter((meeting) => meeting.status === "Attended" || meeting.status === "Won")
          .length,
        dealsWon: wonDeals.length,
        dealsLost: deals.filter((deal) => deal.status === "Closed_Lost").length,
        revenue: wonDeals.reduce((sum, deal) => sum + (deal.totalAmount || 0), 0),
        leads,
        meetings,
        deals,
      },
    };
  }

  return { status: "role_not_supported" as const };
}

export async function getTeleSalesTeamDrill(input: Requester & DateRangeParams & { drillDown: string | null }) {
  const createdAtFilter = buildCreatedAtFilter(input);
  const meetingDateFilter = buildMeetingDateFilter(input);
  const { agentIds } = await getTeamAgentIds({
    requester: input,
    agentRole: "tele_sales_agent",
    managerRole: "tele_sales_manager",
  });

  if (input.drillDown === "calls") {
    return { status: "ok" as const, data: await findTeleSalesDrillCallLogs(agentIds, createdAtFilter) };
  }

  if (input.drillDown === "meetings") {
    return {
      status: "ok" as const,
      data: await findTeleSalesDrillMeetings(agentIds, {}, meetingDateFilter),
    };
  }

  if (input.drillDown === "attended") {
    return {
      status: "ok" as const,
      data: await findTeleSalesDrillMeetings(agentIds, { status: { in: ["Attended", "Won", "Lost"] } }, meetingDateFilter),
    };
  }

  if (input.drillDown === "deals") {
    return {
      status: "ok" as const,
      data: await findTeleSalesDrillDeals(agentIds, createdAtFilter, { createdAt: "desc" }),
    };
  }

  if (input.drillDown === "revenue") {
    return {
      status: "ok" as const,
      data: await findTeleSalesDrillDeals(agentIds, createdAtFilter, { totalAmount: "desc" }),
    };
  }

  return { status: "invalid_drill_down" as const };
}

export async function getSalesTeamDrill(input: Requester & DateRangeParams & { drillDown: string | null }) {
  const createdAtFilter = buildCreatedAtFilter(input);
  const { agentIds } = await getTeamAgentIds({
    requester: input,
    agentRole: "sales_agent",
    managerRole: "sales_manager",
  });

  if (input.drillDown === "leads") {
    return { status: "ok" as const, data: await findSalesDrillLeads(agentIds, createdAtFilter) };
  }

  if (input.drillDown === "meetings") {
    return { status: "ok" as const, data: await findSalesDrillMeetings(agentIds, createdAtFilter) };
  }

  if (input.drillDown === "won") {
    return {
      status: "ok" as const,
      data: await findSalesDrillDeals(agentIds, { in: ["Closed_Won", "Pending"] }, createdAtFilter, {
        createdAt: "desc",
      }),
    };
  }

  if (input.drillDown === "lost") {
    return {
      status: "ok" as const,
      data: await findSalesDrillDeals(agentIds, "Closed_Lost", createdAtFilter, { createdAt: "desc" }),
    };
  }

  if (input.drillDown === "revenue") {
    return {
      status: "ok" as const,
      data: await findSalesDrillDeals(agentIds, { in: ["Closed_Won", "Pending"] }, createdAtFilter, {
        totalAmount: "desc",
      }),
    };
  }

  return { status: "invalid_drill_down" as const };
}

function getChiefSalesDateFilter(range: string) {
  let startDate = new Date(0);
  const now = new Date();
  if (range === "today") {
    startDate = new Date(now.setHours(0, 0, 0, 0));
  } else if (range === "this_week") {
    const day = now.getDay() || 7;
    if (day !== 1) now.setHours(-24 * (day - 1));
    startDate = new Date(now.setHours(0, 0, 0, 0));
  } else if (range === "this_month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return range !== "all" ? { gte: startDate } : undefined;
}

export async function getChiefSalesAnalytics(range: string) {
  const dateFilter = getChiefSalesDateFilter(range);

  const [deals, leadsCount, meetings, teleSalesPerformance, salesPerformance, warnings] = await Promise.all([
    findChiefSalesDeals(dateFilter),
    countChiefSalesLeads(dateFilter),
    findChiefSalesMeetings(dateFilter),
    findChiefSalesTeleSalesPerformance(dateFilter),
    findChiefSalesSalesPerformance(dateFilter),
    findChiefSalesWarnings(),
  ]);

  const wonDeals = deals.filter((deal) => deal.status === "Closed_Won" || deal.status === "Pending");
  const totalRevenue = wonDeals.reduce((sum, deal) => sum + deal.totalAmount, 0);
  const totalNetTarget = wonDeals.reduce((sum, deal) => sum + deal.netTarget, 0);
  const totalCollected = wonDeals.reduce((sum, deal) => {
    const collectedInstallments = deal.installments
      .filter((installment) => installment.isPaid)
      .reduce((instSum, installment) => instSum + installment.amount, 0);
    const collected = (deal.firstAmount || 0) + collectedInstallments;
    return sum + collected;
  }, 0);

  const meetingsAttended = meetings.filter((meeting) => meeting.status === "Attended").length;
  const meetingsLost = meetings.filter((meeting) => meeting.status === "Lost").length;

  return {
    overview: {
      totalRevenue,
      totalNetTarget,
      totalCollected,
      totalDeals: wonDeals.length,
      totalLeads: leadsCount,
      meetingsBooked: meetings.length,
      meetingsAttended,
      meetingsLost,
    },
    chartData: {
      revenueProgress: 65,
      leadsConversion: leadsCount ? Math.round((wonDeals.length / leadsCount) * 100) : 0,
    },
    teleSalesTeam: teleSalesPerformance
      .map((agent) => ({
        name: agent.name,
        meetingsBooked: agent.meetingsAsTele.length,
        attended: agent.meetingsAsTele.filter((meeting) => meeting.status === "Attended").length,
        lost: agent.meetingsAsTele.filter((meeting) => meeting.status === "Lost").length,
      }))
      .sort((a, b) => b.meetingsBooked - a.meetingsBooked),
    salesTeam: salesPerformance
      .map((agent) => ({
        name: agent.name,
        dealsClosed: agent.salesDeals.filter((deal) => deal.status === "Closed_Won" || deal.status === "Pending")
          .length,
        revenueGenerated: agent.salesDeals.reduce((sum, deal) => sum + deal.totalAmount, 0),
        avgDealSize: agent.salesDeals.length
          ? Math.round(agent.salesDeals.reduce((sum, deal) => sum + deal.totalAmount, 0) / agent.salesDeals.length)
          : 0,
      }))
      .sort((a, b) => b.revenueGenerated - a.revenueGenerated),
    recentDeals: deals.slice(0, 10),
    warnings,
  };
}
