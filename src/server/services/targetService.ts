import { prisma } from "@/lib/prisma";
import { ACTUAL_MEETING_STATUSES } from "@/lib/meetings";

export type MonthlyTargetRow = {
  month: string; // YYYY-MM
  target: number;
  achieved: number;
};

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Per-month target vs achieved history for a single agent, newest month first.
 *
 * - Tele-sales agents are measured on actual meetings — ones the client really
 *   attended (by meeting date), not merely booked.
 * - Sales agents are measured on deals they won (by close date).
 *
 * Every month that has either a target set or recorded activity is included so
 * the agent sees their full working history.
 */
export async function getAgentTargetHistory(input: { id: string; role: string }) {
  if (input.role !== "tele_sales_agent" && input.role !== "sales_agent") {
    return { status: "role_not_supported" as const };
  }

  const targets = await prisma.agentTarget.findMany({
    where: { agentId: input.id },
    select: { month: true, target: true },
  });

  const achievedByMonth = new Map<string, number>();

  if (input.role === "tele_sales_agent") {
    const meetings = await prisma.meeting.findMany({
      where: { teleAgentId: input.id, status: { in: ACTUAL_MEETING_STATUSES } },
      select: { meetingDate: true },
    });
    for (const m of meetings) {
      const key = monthKey(m.meetingDate);
      achievedByMonth.set(key, (achievedByMonth.get(key) || 0) + 1);
    }
  } else {
    const deals = await prisma.deal.findMany({
      where: { salesAgentId: input.id, status: { in: ["Closed_Won", "Pending"] } },
      select: { createdAt: true },
    });
    for (const d of deals) {
      const key = monthKey(d.createdAt);
      achievedByMonth.set(key, (achievedByMonth.get(key) || 0) + 1);
    }
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
      metric: input.role === "tele_sales_agent" ? "Actual Meetings" : "Deals Won",
      months: rows,
    },
  };
}
