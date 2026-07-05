import { recomputeMonth, recomputeTelesalesBonuses } from "@/lib/commissions";
import { safeTrigger } from "@/lib/pusher";
import { upsertCommissionRule, upsertSystemConfig } from "@/server/repositories/settingsRepository";

// Config keys that affect payroll/commission math. Changing any of them triggers
// an immediate recompute of the current month so the new values apply live.
const FINANCE_KEYS = new Set(["telesales_bonus_rules", "commission_tiers", "gateway_fee_pct"]);

export async function saveSystemConfig(input: { adminId: string; key: any; value: any }) {
  const { adminId, key, value } = input;

  if (typeof key !== "string" || !key.trim() || typeof value !== "string") {
    return { status: "missing_fields" as const };
  }

  // Validate JSON-shaped finance keys before saving so we never persist garbage
  // that would later break a recompute.
  if (key === "telesales_bonus_rules" || key === "commission_tiers") {
    try {
      const parsed = JSON.parse(value);
      if (key === "commission_tiers" && !Array.isArray(parsed)) {
        return { status: "invalid_value" as const, message: "commission_tiers must be a JSON array" };
      }
      if (key === "telesales_bonus_rules" && (typeof parsed !== "object" || parsed === null)) {
        return { status: "invalid_value" as const, message: "telesales_bonus_rules must be a JSON object" };
      }
    } catch {
      return { status: "invalid_value" as const, message: `${key} must be valid JSON` };
    }
  }
  if (key === "gateway_fee_pct") {
    const fee = parseFloat(value);
    if (isNaN(fee) || fee < 0 || fee >= 1) {
      return { status: "invalid_value" as const, message: "gateway_fee_pct must be a decimal between 0 and 1" };
    }
  }

  const config = await upsertSystemConfig({ key, value, updatedById: adminId });

  // Live-apply: recompute the current month so the change is reflected immediately
  // in Finance and My Profile, and notify any open finance dashboard to refresh.
  let recomputed = false;
  if (FINANCE_KEYS.has(key)) {
    const month = new Date().toISOString().slice(0, 7);
    try {
      await Promise.all([recomputeMonth(month), recomputeTelesalesBonuses(month)]);
      recomputed = true;
      await safeTrigger("finance-channel", "config-updated", { key, month });
    } catch (e) {
      console.error("Live recompute after config change failed:", e);
    }
  }

  return { status: "ok" as const, config, recomputed };
}

export async function saveCommissionRule(input: { role: string; percentage: any }) {
  const rule = await upsertCommissionRule({
    role: input.role,
    percentage: parseFloat(input.percentage),
  });
  return { status: "ok" as const, rule };
}
