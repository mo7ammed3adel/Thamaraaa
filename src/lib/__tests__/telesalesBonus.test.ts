import { describe, it, expect } from "vitest";
import {
  meetingBonusForAchievement,
  computeTelesalesBonusItems,
  mergeAutoBonuses,
  normalizeTelesalesBonusRules,
  DEFAULT_TELESALES_BONUS_RULES,
} from "../telesalesBonus";

describe("meetingBonusForAchievement", () => {
  const rules = DEFAULT_TELESALES_BONUS_RULES;

  it("returns the highest tier reached", () => {
    expect(meetingBonusForAchievement(160, rules)?.achievementPct).toBe(150);
    expect(meetingBonusForAchievement(130, rules)?.achievementPct).toBe(125);
    expect(meetingBonusForAchievement(100, rules)?.achievementPct).toBe(100);
  });

  it("returns null below the lowest tier", () => {
    expect(meetingBonusForAchievement(99, rules)).toBeNull();
    expect(meetingBonusForAchievement(0, rules)).toBeNull();
  });
});

describe("computeTelesalesBonusItems", () => {
  const rules = DEFAULT_TELESALES_BONUS_RULES;

  it("adds a meeting bonus and a per-conversion bonus", () => {
    const items = computeTelesalesBonusItems({
      actualMeetings: 30,
      meetingsTarget: 20, // 150%
      conversions: 3,
      rules,
    });
    expect(items).toHaveLength(2);
    expect(items[0].amount).toBe(1000); // 150% tier
    expect(items[1].amount).toBe(300); // 3 × 100
    expect(items.every((i) => i.auto)).toBe(true);
  });

  it("adds no meeting bonus when target is zero or unmet", () => {
    expect(
      computeTelesalesBonusItems({ actualMeetings: 5, meetingsTarget: 0, conversions: 0, rules })
    ).toHaveLength(0);

    const belowTarget = computeTelesalesBonusItems({
      actualMeetings: 5,
      meetingsTarget: 20,
      conversions: 0,
      rules,
    });
    expect(belowTarget).toHaveLength(0);
  });
});

describe("mergeAutoBonuses", () => {
  it("keeps manual items and replaces previous auto items", () => {
    const existing = JSON.stringify([
      { reason: "Manual spot bonus", amount: 500 },
      { reason: "Old auto", amount: 999, auto: true },
    ]);
    const fresh = [{ reason: "New auto", amount: 300, auto: true }];
    const merged = mergeAutoBonuses(existing, fresh);
    expect(merged).toEqual([
      { reason: "Manual spot bonus", amount: 500 },
      { reason: "New auto", amount: 300, auto: true },
    ]);
  });

  it("is idempotent and tolerates malformed JSON", () => {
    const fresh = [{ reason: "Auto", amount: 100, auto: true }];
    expect(mergeAutoBonuses(null, fresh)).toEqual(fresh);
    expect(mergeAutoBonuses("not json", fresh)).toEqual(fresh);
    expect(mergeAutoBonuses(JSON.stringify(fresh), fresh)).toEqual(fresh);
  });
});

describe("normalizeTelesalesBonusRules", () => {
  it("falls back to defaults for invalid input", () => {
    expect(normalizeTelesalesBonusRules(null)).toBe(DEFAULT_TELESALES_BONUS_RULES);
    expect(normalizeTelesalesBonusRules({})).toEqual(DEFAULT_TELESALES_BONUS_RULES);
  });

  it("accepts and sorts custom tiers", () => {
    const rules = normalizeTelesalesBonusRules({
      meetingTiers: [
        { achievementPct: 100, amount: 50 },
        { achievementPct: 200, amount: 500 },
      ],
      perConversionAmount: 25,
    });
    expect(rules.meetingTiers[0].achievementPct).toBe(200);
    expect(rules.perConversionAmount).toBe(25);
  });
});
