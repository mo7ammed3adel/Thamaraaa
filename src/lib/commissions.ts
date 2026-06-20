import { prisma } from "./prisma";

/**
 * Commission Engine — implements the spec's financial rules.
 *
 *   Net Target  = Cash × 1.0 + (Tabby/Tamara × (1 − gateway_fee_pct))
 *   Tier 1      = 1.5%  on net  1,000 –  15,000
 *   Tier 2      = 2.0%  on net 15,001 –  20,000
 *   Tier 3      = 2.5%  on net           20,000+
 *
 *   Achievement multiplier (vs HrRecord.monthlyTarget):
 *     <100% target ─ pro-rata
 *      100% target ─ 100% commission
 *      125% target ─ 125% commission
 *      150% target ─ 150% commission
 *
 *   netPayout = baseSalary + (commissionAmount × multiplier) + sum(bonuses) − sum(deductions)
 */

export interface BonusItem {
  reason: string;
  amount: number;
}

export interface DeductionItem {
  reason: string;
  amount: number;
}

export interface CommissionTier {
  minNet: number;
  maxNet: number | null; // null = unbounded
  pct: number; // e.g. 0.015 for 1.5%
}

export const DEFAULT_TIERS: CommissionTier[] = [
  { minNet: 1000, maxNet: 15000, pct: 0.015 },
  { minNet: 15001, maxNet: 20000, pct: 0.02 },
  { minNet: 20001, maxNet: null, pct: 0.025 },
];

const DEFAULT_GATEWAY_FEE_PCT = 0.07;

/**
 * Reads system config tiers and gateway fee, falling back to spec defaults.
 */
export async function loadCommissionConfig(): Promise<{ tiers: CommissionTier[]; gatewayFeePct: number }> {
  const [tiersConfig, feeConfig] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: "commission_tiers" } }),
    prisma.systemConfig.findUnique({ where: { key: "gateway_fee_pct" } }),
  ]);

  let tiers: CommissionTier[] = DEFAULT_TIERS;
  if (tiersConfig?.value) {
    try {
      const parsed = JSON.parse(tiersConfig.value);
      if (Array.isArray(parsed) && parsed.length > 0) tiers = parsed;
    } catch {
      // keep defaults
    }
  }

  let gatewayFeePct = DEFAULT_GATEWAY_FEE_PCT;
  if (feeConfig?.value) {
    const parsed = parseFloat(feeConfig.value);
    if (!isNaN(parsed) && parsed >= 0 && parsed < 1) gatewayFeePct = parsed;
  }

  return { tiers, gatewayFeePct };
}

/**
 * Pure: applies tier brackets to a netTarget amount, returning the weighted commission.
 * Uses tiered calculation (each portion of net falls under its own bracket).
 */
export function commissionFromNet(net: number, tiers: CommissionTier[]): { amount: number; effectivePct: number } {
  if (net <= 0) return { amount: 0, effectivePct: 0 };
  let amount = 0;
  for (const tier of tiers) {
    if (net < tier.minNet) continue;
    const upper = tier.maxNet ?? Infinity;
    const segment = Math.min(net, upper) - tier.minNet + 1;
    if (segment > 0) amount += segment * tier.pct;
    if (net <= upper) break;
  }
  const effectivePct = net > 0 ? amount / net : 0;
  return { amount: Math.round(amount * 100) / 100, effectivePct };
}

/**
 * Achievement multiplier per spec.
 *  100% target → 1.00, 125% → 1.25, 150% → 1.50.
 *  Below 100% scales linearly (pro-rata) so under-achievers get partial commission.
 *  Above 150% caps at 1.50 to prevent runaway payouts.
 */
export function achievementMultiplier(achievementPct: number): number {
  if (achievementPct >= 150) return 1.5;
  if (achievementPct >= 125) return 1.25;
  if (achievementPct >= 100) return 1.0;
  return Math.max(0, achievementPct / 100);
}

/**
 * Sums a JSON-encoded list of {reason, amount} entries safely.
 */
export function sumLineItems(json: string | null): number {
  if (!json) return 0;
  try {
    const items = JSON.parse(json);
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0);
  } catch {
    return 0;
  }
}

/**
 * Recomputes commissions for every Sales Agent for a given month (YYYY-MM).
 *
 * Net target derivation: per spec, net target only counts deals closed by that agent in that month.
 * Cash-method portion is at 1.0; Tabby/Tamara portion is multiplied by (1 − gatewayFeePct).
 *
 * Existing finalized rows are NOT overwritten.
 *
 * @param month YYYY-MM string
 * @returns Array of upserted Commission rows
 */
export async function recomputeMonth(month: string) {
  const [year, mm] = month.split("-").map((s) => parseInt(s, 10));
  if (!year || !mm) throw new Error(`Invalid month: ${month}`);

  const start = new Date(year, mm - 1, 1);
  const end = new Date(year, mm, 1);

  const { tiers, gatewayFeePct } = await loadCommissionConfig();

  const salesAgents = await prisma.user.findMany({
    where: { role: "sales_agent" },
    include: { hrRecord: true },
  });

  const results: any[] = [];
  for (const agent of salesAgents) {
    const deals = await prisma.deal.findMany({
      where: {
        salesAgentId: agent.id,
        createdAt: { gte: start, lt: end },
        status: "Closed_Won",
      },
    });

    let netTarget = 0;
    for (const d of deals) {
      const amount = d.totalAmount || 0;
      if (d.paymentMethod === "Tabby" || d.paymentMethod === "Tamara") {
        netTarget += amount * (1 - gatewayFeePct);
      } else {
        netTarget += amount;
      }
    }

    const { amount: baseCommission, effectivePct } = commissionFromNet(netTarget, tiers);
    const monthlyTarget = agent.hrRecord?.monthlyTarget || 0;
    const achievementPct = monthlyTarget > 0 ? (netTarget / monthlyTarget) * 100 : 0;
    const multiplier = achievementMultiplier(achievementPct);
    const commissionAmount = Math.round(baseCommission * multiplier * 100) / 100;
    const baseSalary = agent.hrRecord?.baseSalary || 0;

    const existing = await prisma.commission.findFirst({ where: { userId: agent.id, month } });
    if (existing?.finalized) {
      results.push(existing);
      continue;
    }

    const bonusesSum = sumLineItems(existing?.bonuses ?? null);
    const deductionsSum = sumLineItems(existing?.deductions ?? null);
    const netPayout = Math.round((baseSalary + commissionAmount + bonusesSum - deductionsSum) * 100) / 100;

    if (existing) {
      const updated = await prisma.commission.update({
        where: { id: existing.id },
        data: { netTarget, commissionPct: effectivePct, commissionAmount, netPayout },
      });
      results.push(updated);
    } else {
      const created = await prisma.commission.create({
        data: {
          userId: agent.id,
          month,
          netTarget,
          commissionPct: effectivePct,
          commissionAmount,
          bonuses: "[]",
          deductions: "[]",
          netPayout,
          finalized: false,
        },
      });
      results.push(created);
    }
  }

  return results;
}
