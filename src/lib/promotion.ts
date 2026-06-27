import { prisma } from "./prisma";
import { parsePerformanceHistory } from "@/server/parsers/hr";

/**
 * Promotion Engine — encodes the spec's rules:
 *   Junior  → Mid       at avg ≥ 60% over last 3 months
 *   Mid     → Senior    at avg 80–90%+ over last 3 months
 *   Senior  → TL        at ≥ 3 months active as Senior (with hitting target)
 *   50–70%             → warning recommendation
 *   < 50%              → termination flag recommendation
 *
 * Performance per month is read from `Commission` rows (netPayout ratio vs monthlyTarget),
 * with `HrRecord.performanceHistory` as a fallback when commissions haven't been finalized.
 */

export type PromotionRecommendation = "promote" | "warn" | "terminate" | "none";

export interface PromotionEvaluation {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  level: string | null;
  monthlyTarget: number;
  warningCount: number;
  terminationFlag: boolean;
  promotionEligible: boolean;
  monthsEvaluated: number;
  avgAchievementPct: number; // 0–200+
  recommendation: PromotionRecommendation;
  recommendationReason: string;
  // Suggested next level if recommendation === "promote"
  nextLevel: string | null;
  // Suggested next role if a level promotion implies a role change (Senior → TL)
  nextRole: string | null;
}

const PROMOTION_PATH: Record<string, string> = {
  Junior: "Mid",
  Mid: "Senior",
  Senior: "Senior", // TL change is a role change, not a level change
};

// Map agent roles → their team-leader role for Senior → TL promotion suggestion.
const SENIOR_TO_TL_ROLE: Record<string, string> = {
  agent_seo: "team_leader_seo",
  agent_content_seo: "team_leader_seo",
  agent_social_media: "team_leader_social_media",
  agent_media_buyer: "team_leader_media_buyer",
  agent_graphic_designer: "leader_graphic_designer",
  agent_motion_graphic: "leader_motion_graphic",
  agent_ui: "leader_ui",
};

const PROMOTION_THRESHOLDS = {
  juniorToMid: 60,
  midToSenior: 80,
  warningLow: 50,
  warningHigh: 70,
  termination: 50,
} as const;

/**
 * Computes the most-recent N months performance percentages for a user.
 * Uses Commission rows when finalized, otherwise falls back to HrRecord.performanceHistory.
 *
 * @param userId       The employee
 * @param monthlyTarget HrRecord.monthlyTarget — denominator for % achievement
 * @param performanceHistory HrRecord.performanceHistory JSON — fallback
 * @returns Array of { month, achievementPct } ordered oldest → newest, capped at 12 months
 */
async function computeMonthlyAchievements(
  userId: string,
  monthlyTarget: number,
  performanceHistory: string
): Promise<{ month: string; achievementPct: number }[]> {
  const commissions = await prisma.commission.findMany({
    where: { userId },
    orderBy: { month: "desc" },
    take: 12,
  });

  if (commissions.length > 0 && monthlyTarget > 0) {
    return commissions
      .map((c) => ({
        month: c.month,
        achievementPct: (c.netTarget / monthlyTarget) * 100,
      }))
      .reverse();
  }

  // Fallback: legacy hitTarget binary history
  return parsePerformanceHistory(performanceHistory).slice(-12).map((h) => ({
    month: h.month,
    achievementPct: h.hitTarget ? 100 : 0,
  }));
}

/**
 * Evaluates a single HrRecord and returns a PromotionEvaluation.
 * Pure logic given the HrRecord + computed achievements.
 */
function evaluate(
  userId: string,
  userName: string,
  userEmail: string,
  role: string,
  level: string | null,
  hr: { monthlyTarget: number; warningCount: number; terminationFlag: boolean; promotionEligible: boolean },
  achievements: { month: string; achievementPct: number }[]
): PromotionEvaluation {
  const last3 = achievements.slice(-3);
  const monthsEvaluated = last3.length;
  const avgPct =
    last3.length > 0 ? last3.reduce((a, b) => a + b.achievementPct, 0) / last3.length : 0;

  let recommendation: PromotionRecommendation = "none";
  let recommendationReason = "";
  let nextLevel: string | null = null;
  let nextRole: string | null = null;

  // Termination wins (lowest band)
  if (monthsEvaluated >= 3 && avgPct < PROMOTION_THRESHOLDS.termination) {
    recommendation = "terminate";
    recommendationReason = `Avg ${avgPct.toFixed(0)}% over ${monthsEvaluated} months is below the 50% termination threshold.`;
  } else if (
    monthsEvaluated >= 3 &&
    avgPct >= PROMOTION_THRESHOLDS.warningLow &&
    avgPct < PROMOTION_THRESHOLDS.warningHigh
  ) {
    recommendation = "warn";
    recommendationReason = `Avg ${avgPct.toFixed(0)}% over ${monthsEvaluated} months is in the 50–70% warning band.`;
  } else if (monthsEvaluated >= 3) {
    // Promotion logic depends on current level.
    if (level === "Junior" && avgPct >= PROMOTION_THRESHOLDS.juniorToMid) {
      recommendation = "promote";
      nextLevel = "Mid";
      recommendationReason = `Junior with ${avgPct.toFixed(0)}% avg ≥ 60% — eligible for Mid.`;
    } else if (level === "Mid" && avgPct >= PROMOTION_THRESHOLDS.midToSenior) {
      recommendation = "promote";
      nextLevel = "Senior";
      recommendationReason = `Mid with ${avgPct.toFixed(0)}% avg ≥ 80% — eligible for Senior.`;
    } else if (level === "Senior" && SENIOR_TO_TL_ROLE[role] && avgPct >= PROMOTION_THRESHOLDS.midToSenior) {
      // Senior + 3 active months hitting target → TL role
      recommendation = "promote";
      nextLevel = "Senior";
      nextRole = SENIOR_TO_TL_ROLE[role];
      recommendationReason = `Senior with 3 strong months — eligible for ${nextRole.replace(/_/g, " ")}.`;
    }
  }

  return {
    userId,
    userName,
    userEmail,
    role,
    level,
    monthlyTarget: hr.monthlyTarget,
    warningCount: hr.warningCount,
    terminationFlag: hr.terminationFlag,
    promotionEligible: hr.promotionEligible,
    monthsEvaluated,
    avgAchievementPct: avgPct,
    recommendation,
    recommendationReason,
    nextLevel,
    nextRole,
  };
}

/**
 * Evaluates every employee with an HrRecord and returns recommendations.
 * Read-only — does not mutate the database.
 */
export async function evaluateAllEmployees(): Promise<PromotionEvaluation[]> {
  const records = await prisma.hrRecord.findMany({
    include: { user: { select: { id: true, name: true, email: true, role: true, level: true, status: true } } },
  });

  const results: PromotionEvaluation[] = [];
  for (const r of records) {
    if (!r.user || r.user.status !== "Active") continue;
    const achievements = await computeMonthlyAchievements(r.userId, r.monthlyTarget, r.performanceHistory);
    results.push(
      evaluate(
        r.user.id,
        r.user.name,
        r.user.email,
        r.user.role,
        r.user.level,
        {
          monthlyTarget: r.monthlyTarget,
          warningCount: r.warningCount,
          terminationFlag: r.terminationFlag,
          promotionEligible: r.promotionEligible,
        },
        achievements
      )
    );
  }
  return results;
}

export const PROMOTION_LEVEL_NEXT = PROMOTION_PATH;
export { PROMOTION_THRESHOLDS, SENIOR_TO_TL_ROLE };
