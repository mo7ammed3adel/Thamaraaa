import { prisma } from "@/lib/prisma";
import { ACTUAL_MEETING_STATUSES } from "@/lib/meetings";
import { FUND_DEAL_STATUSES } from "@/lib/deals";

export type MonthlyTargetRow = {
  month: string; // YYYY-MM
  target: number;
  achieved: number;
};

const ROLES_WITH_TARGETS = [
  "tele_sales_agent",
  "sales_agent",
  "tele_sales_manager",
  "sales_manager",
  "chief_sales",
] as const;

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function addToMonth(byMonth: Map<string, number>, date: Date, amount: number) {
  const key = monthKey(date);
  byMonth.set(key, (byMonth.get(key) || 0) + amount);
}

/** Direct reports of a manager for a given agent role (used to scope team-wide targets). */
async function findTeamAgentIds(managerId: string, agentRole: string): Promise<string[]> {
  const agents = await prisma.user.findMany({
    where: { role: agentRole, directManagerId: managerId },
    select: { id: true },
  });
  return agents.map((a) => a.id);
}

async function achievedMeetingsByMonth(teleAgentIds: string[]): Promise<Map<string, number>> {
  const byMonth = new Map<string, number>();
  if (teleAgentIds.length === 0) return byMonth;
  const meetings = await prisma.meeting.findMany({
    where: { teleAgentId: { in: teleAgentIds }, status: { in: ACTUAL_MEETING_STATUSES } },
    select: { meetingDate: true },
  });
  for (const m of meetings) addToMonth(byMonth, m.meetingDate, 1);
  return byMonth;
}

async function achievedFundByMonth(salesAgentIds: string[]): Promise<Map<string, number>> {
  const byMonth = new Map<string, number>();
  if (salesAgentIds.length === 0) return byMonth;
  const deals = await prisma.deal.findMany({
    where: { salesAgentId: { in: salesAgentIds }, status: { in: FUND_DEAL_STATUSES } },
    select: { createdAt: true, totalAmount: true },
  });
  for (const d of deals) addToMonth(byMonth, d.createdAt, d.totalAmount || 0);
  return byMonth;
}

/**
 * Per-month target vs achieved history for a single user, newest month first.
 *
 * Two metrics, one per track:
 *   - "meetings" - actual meetings the client attended (Meeting.status
 *     Attended/Won/Lost), for tele-sales agents (their own bookings) and
 *     tele-sales managers (their team's bookings).
 *   - "fund" - contracted revenue in SAR (deal totalAmount, Closed_Won +
 *     Pending), for sales agents (their own deals), sales managers (their
 *     team's deals plus any personal deals), and Chief Sales (every sales
 *     deal company-wide).
 *
 * Every month that has either a target set or recorded activity is included so
 * the user sees their full working history.
 */
export async function getAgentTargetHistory(input: { id: string; role: string }) {
  if (!ROLES_WITH_TARGETS.includes(input.role as (typeof ROLES_WITH_TARGETS)[number])) {
    return { status: "role_not_supported" as const };
  }

  const targets = await prisma.agentTarget.findMany({
    where: { agentId: input.id },
    select: { month: true, target: true },
  });

  let achievedByMonth: Map<string, number>;
  let unit: "meetings" | "SAR";
  let metric: string;

  if (input.role === "tele_sales_agent") {
    achievedByMonth = await achievedMeetingsByMonth([input.id]);
    unit = "meetings";
    metric = "Actual Meetings";
  } else if (input.role === "tele_sales_manager") {
    const teamIds = await findTeamAgentIds(input.id, "tele_sales_agent");
    achievedByMonth = await achievedMeetingsByMonth(teamIds);
    unit = "meetings";
    metric = "Team Actual Meetings";
  } else if (input.role === "sales_agent") {
    achievedByMonth = await achievedFundByMonth([input.id]);
    unit = "SAR";
    metric = "Fund (SAR)";
  } else if (input.role === "sales_manager") {
    const teamIds = await findTeamAgentIds(input.id, "sales_agent");
    achievedByMonth = await achievedFundByMonth([...teamIds, input.id]);
    unit = "SAR";
    metric = "Team Fund (SAR)";
  } else {
    // chief_sales - company-wide fund across sales agents and sales managers.
    const salesUsers = await prisma.user.findMany({
      where: { role: { in: ["sales_agent", "sales_manager"] } },
      select: { id: true },
    });
    achievedByMonth = await achievedFundByMonth(salesUsers.map((a) => a.id));
    unit = "SAR";
    metric = "Company Fund (SAR)";
  }

  const byMonth = new Map<string, MonthlyTargetRow>();
  for (const t of targets) {
    byMonth.set(t.month, { month: t.month, target: t.target, achieved: 0 });
  }
  achievedByMonth.forEach((achieved, month) => {
    const existing = byMonth.get(month);
    if (existing) existing.achieved = achieved;
    else byMonth.set(month, { month, target: 0, achieved });
  });

  const rows = Array.from(byMonth.values()).sort((a, b) => (a.month < b.month ? 1 : -1));

  return {
    status: "ok" as const,
    data: {
      role: input.role,
      metric,
      unit,
      months: rows,
    },
  };
}
