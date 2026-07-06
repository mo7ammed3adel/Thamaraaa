import type { BonusItem } from "./commissions";

/**
 * TeleSales bonus rules (spec §14.4).
 *
 *   - A meetings-target bonus when the agent reaches 100% / 125% / 150% of their
 *     monthly meetings target (AgentTarget), measured on actual meetings — ones
 *     the client really attended, not merely booked.
 *   - An extra per-conversion bonus for leads the agent handled that closed as
 *     Closed_Won deals.
 *
 * Amounts are configurable from System Config (`telesales_bonus_rules`); the
 * defaults below are sensible starting values, not hard business rules.
 *
 * This module is pure (no Prisma / IO) so the scoring is unit-testable. The DB
 * recompute that feeds these functions lives in `commissions.ts`.
 */

export interface MeetingBonusTier {
  /** Achievement threshold as a percentage of the meetings target, e.g. 125. */
  achievementPct: number;
  /** Flat bonus amount (SAR) granted at this tier. */
  amount: number;
}

export interface TelesalesBonusRules {
  /** Meeting tiers, evaluated highest-threshold-first. */
  meetingTiers: MeetingBonusTier[];
  /** Flat bonus per converted (Closed_Won) deal. */
  perConversionAmount: number;
}

export const DEFAULT_TELESALES_BONUS_RULES: TelesalesBonusRules = {
  meetingTiers: [
    { achievementPct: 150, amount: 1000 },
    { achievementPct: 125, amount: 600 },
    { achievementPct: 100, amount: 300 },
  ],
  perConversionAmount: 100,
};

/** Normalises arbitrary config JSON into valid rules, falling back to defaults. */
export function normalizeTelesalesBonusRules(parsed: unknown): TelesalesBonusRules {
  if (!parsed || typeof parsed !== "object") return DEFAULT_TELESALES_BONUS_RULES;
  const obj = parsed as Record<string, unknown>;

  const meetingTiers = Array.isArray(obj.meetingTiers)
    ? (obj.meetingTiers as unknown[])
        .filter(
          (t): t is MeetingBonusTier =>
            !!t &&
            typeof t === "object" &&
            typeof (t as MeetingBonusTier).achievementPct === "number" &&
            typeof (t as MeetingBonusTier).amount === "number"
        )
        .sort((a, b) => b.achievementPct - a.achievementPct)
    : [];

  const perConversionAmount =
    typeof obj.perConversionAmount === "number" && obj.perConversionAmount >= 0
      ? obj.perConversionAmount
      : DEFAULT_TELESALES_BONUS_RULES.perConversionAmount;

  return {
    meetingTiers: meetingTiers.length ? meetingTiers : DEFAULT_TELESALES_BONUS_RULES.meetingTiers,
    perConversionAmount,
  };
}

/**
 * Returns the highest meeting tier the agent qualifies for, or null if they are
 * below the lowest threshold. Tiers are evaluated highest-first.
 */
export function meetingBonusForAchievement(
  achievementPct: number,
  rules: TelesalesBonusRules
): MeetingBonusTier | null {
  const sorted = [...rules.meetingTiers].sort((a, b) => b.achievementPct - a.achievementPct);
  for (const tier of sorted) {
    if (achievementPct >= tier.achievementPct) return tier;
  }
  return null;
}

/**
 * Builds the auto-generated bonus line items for a TeleSales agent for a month.
 * Every item is tagged `auto: true` so a later recompute can refresh them
 * without clobbering manual adjustments an accountant may have added.
 */
export function computeTelesalesBonusItems(input: {
  /** Meetings the client actually attended (status Attended/Won/Lost). */
  actualMeetings: number;
  meetingsTarget: number;
  conversions: number;
  rules: TelesalesBonusRules;
}): BonusItem[] {
  const { actualMeetings, meetingsTarget, conversions, rules } = input;
  const items: BonusItem[] = [];

  const achievementPct = meetingsTarget > 0 ? (actualMeetings / meetingsTarget) * 100 : 0;
  const tier = meetingBonusForAchievement(achievementPct, rules);
  if (tier && tier.amount > 0) {
    items.push({
      reason: `Meetings target ${tier.achievementPct}% reached (${actualMeetings}/${meetingsTarget})`,
      amount: tier.amount,
      auto: true,
    });
  }

  if (conversions > 0 && rules.perConversionAmount > 0) {
    items.push({
      reason: `Converted deals (${conversions} × ${rules.perConversionAmount} SAR)`,
      amount: conversions * rules.perConversionAmount,
      auto: true,
    });
  }

  return items;
}

/**
 * Merges freshly-computed auto bonuses with whatever is already stored, keeping
 * manual (non-auto) bonus items intact and replacing the previous auto ones.
 * Idempotent: re-running a recompute yields the same result.
 */
export function mergeAutoBonuses(existingJson: string | null, autoItems: BonusItem[]): BonusItem[] {
  let existing: BonusItem[] = [];
  if (existingJson) {
    try {
      const parsed = JSON.parse(existingJson);
      if (Array.isArray(parsed)) existing = parsed as BonusItem[];
    } catch {
      // ignore malformed JSON — treat as empty
    }
  }
  const manual = existing.filter((item) => !item?.auto);
  return [...manual, ...autoItems];
}
