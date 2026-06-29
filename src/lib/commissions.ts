import { prisma } from "./prisma";
import { parseCommissionTiers, sumFinanceLineItems, stringifyFinanceLineItems } from "@/server/parsers/finance";
import { mergeAutoBonuses } from "./telesalesBonus";

/**
 * Finance commission engine.
 *
 * The accountant view is fed from the single Commission table, but the math
 * below follows the PDF rules for Sales, Sales Team Leaders, TeleSales, and
 * TeleSales Managers. The current schema does not store explicit clientType,
 * dealType, or refund rows, so the engine maps existing fields conservatively:
 *
 * - lead.customerType "VIP" or "Special" => VIP, otherwise Standard.
 * - lead.classification => Hot / Cold / Regular.
 * - Deal.netTarget is used as the post Tabby/Tamara fee base when present.
 * - Refund deductions remain manual accountant deductions until refund data is
 *   modeled explicitly.
 */

export interface BonusItem {
  reason: string;
  amount: number;
  auto?: boolean;
}

export interface DeductionItem {
  reason: string;
  amount: number;
}

export interface CommissionTier {
  minNet: number;
  maxNet: number | null;
  pct: number;
}

export interface FlatTier {
  tier: number;
  label: string;
  min: number;
  max: number | null;
  pct: number;
}

export interface CommissionBreakdown {
  plan: "sales_agent" | "sales_team_leader" | "telesales_agent" | "telesales_manager" | "payroll";
  planLabel: string;
  grossFund: number;
  netCommissionBase: number;
  gatewayFees: number;
  tierLabel: string;
  tierPct: number;
  commissionAmount: number;
  targetBonus: number;
  metrics: Record<string, number | string>;
  components: { label: string; amount: number; pct?: number }[];
  notes: string[];
}

type DealForCommission = {
  id?: string;
  totalAmount: number | null;
  netTarget?: number | null;
  paymentMethod?: string | null;
  package?: string | null;
  lead?: {
    classification?: string | null;
    customerType?: string | null;
  } | null;
};

type UserWithHr = {
  id: string;
  role: string | null;
  hrRecord?: { baseSalary: number | null } | null;
};

export const DEFAULT_TIERS: CommissionTier[] = [
  { minNet: 1, maxNet: 15000, pct: 0.015 },
  { minNet: 15001, maxNet: 25000, pct: 0.02 },
  { minNet: 25001, maxNet: 30000, pct: 0.025 },
  { minNet: 30001, maxNet: null, pct: 0.03 },
];

export const SALES_AGENT_TIERS: FlatTier[] = [
  { tier: 1, label: "Sales Tier 1", min: 1, max: 15000, pct: 0.015 },
  { tier: 2, label: "Sales Tier 2", min: 15001, max: 25000, pct: 0.02 },
  { tier: 3, label: "Sales Tier 3", min: 25001, max: 30000, pct: 0.025 },
  { tier: 4, label: "Sales Tier 4", min: 30001, max: null, pct: 0.03 },
];

export const SALES_TEAM_LEADER_TIERS: FlatTier[] = [
  { tier: 1, label: "Team Leader Tier 1", min: 1, max: 50000, pct: 0.005 },
  { tier: 2, label: "Team Leader Tier 2", min: 50001, max: 75000, pct: 0.01 },
  { tier: 3, label: "Team Leader Tier 3", min: 75001, max: 100000, pct: 0.015 },
  { tier: 4, label: "Team Leader Tier 4", min: 100001, max: null, pct: 0.02 },
];

export const TELESALES_COLD_TIERS: FlatTier[] = [
  { tier: 1, label: "TeleSales Cold Tier 1", min: 0, max: 4, pct: 0.005 },
  { tier: 2, label: "TeleSales Cold Tier 2", min: 5, max: 9, pct: 0.0075 },
  { tier: 3, label: "TeleSales Cold Tier 3", min: 10, max: 19, pct: 0.01 },
  { tier: 4, label: "TeleSales Cold Tier 4", min: 20, max: null, pct: 0.0115 },
];

export const DEFAULT_TELESALES_MANAGER_RATES: FlatTier[] = [
  { tier: 1, label: "TeleSales Manager Tier 1", min: 1, max: 1, pct: 0.0025 },
  { tier: 2, label: "TeleSales Manager Tier 2", min: 2, max: 2, pct: 0.005 },
  { tier: 3, label: "TeleSales Manager Tier 3", min: 3, max: 3, pct: 0.0075 },
];

// SystemConfig keys that hold the accountant-editable commission rate tables.
export const COMMISSION_RATE_KEYS = {
  salesAgentTiers: "commission_sales_agent_tiers",
  salesTeamLeaderTiers: "commission_sales_tl_tiers",
  telesalesColdTiers: "commission_telesales_cold_tiers",
  telesalesManagerRates: "commission_telesales_manager_rates",
} as const;

/** Parses a stored JSON rate table, falling back to the built-in defaults on any problem. */
export function parseFlatTiers(json: string | null | undefined, fallback: FlatTier[]): FlatTier[] {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    return parsed.map((tier: any, index: number) => ({
      tier: Number(tier.tier) || index + 1,
      label: typeof tier.label === "string" && tier.label ? tier.label : `Tier ${index + 1}`,
      min: Number(tier.min) || 0,
      max: tier.max === null || tier.max === undefined || tier.max === "" ? null : Number(tier.max),
      pct: Number(tier.pct) || 0,
    }));
  } catch {
    return fallback;
  }
}

// ── Editable formula parameters (every non-tier scalar in the math) ──
export const COMMISSION_PARAMS_KEY = "commission_params";

export type CommissionParams = {
  // Sales agent extra rates (applied to net)
  salesColdExtraPct: number;
  salesHuntPct: number;
  salesVipHuntPct: number;
  salesVipColdPct: number;
  salesVipHotPct: number;
  // Sales team leader target cash bonus (% of tier fund) by achievement %
  tlTargetBonusFullThreshold: number;
  tlTargetBonusFullPct: number;
  tlTargetBonusPartialThreshold: number;
  tlTargetBonusPartialPct: number;
  // Telesales agent extra rates (applied to net)
  telesalesHotPct: number;
  telesalesVipColdPct: number;
  telesalesVipHotPct: number;
  // Telesales agent fixed target bonus (SAR) by achievement %
  telesalesTargetBonusHighThreshold: number;
  telesalesTargetBonusHigh: number;
  telesalesTargetBonusExact: number;
  telesalesTargetBonusOver: number;
  // Telesales manager tier thresholds (cold count / hot conversion %)
  mgrColdTier3Min: number;
  mgrColdTier2Min: number;
  mgrHotTier3Min: number;
  mgrHotTier2Min: number;
};

export const DEFAULT_COMMISSION_PARAMS: CommissionParams = {
  salesColdExtraPct: 0.0075,
  salesHuntPct: 0.05,
  salesVipHuntPct: 0.06,
  salesVipColdPct: 0.035,
  salesVipHotPct: 0.03,
  tlTargetBonusFullThreshold: 100,
  tlTargetBonusFullPct: 0.01,
  tlTargetBonusPartialThreshold: 80,
  tlTargetBonusPartialPct: 0.005,
  telesalesHotPct: 0.0025,
  telesalesVipColdPct: 0.01,
  telesalesVipHotPct: 0.005,
  telesalesTargetBonusHighThreshold: 125,
  telesalesTargetBonusHigh: 3000,
  telesalesTargetBonusExact: 1500,
  telesalesTargetBonusOver: 2000,
  mgrColdTier3Min: 19,
  mgrColdTier2Min: 15,
  mgrHotTier3Min: 60,
  mgrHotTier2Min: 50,
};

/** Merges stored overrides onto the defaults; any missing/invalid key keeps its default. */
export function parseCommissionParams(json: string | null | undefined): CommissionParams {
  if (!json) return DEFAULT_COMMISSION_PARAMS;
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return DEFAULT_COMMISSION_PARAMS;
    const merged: CommissionParams = { ...DEFAULT_COMMISSION_PARAMS };
    for (const key of Object.keys(DEFAULT_COMMISSION_PARAMS) as (keyof CommissionParams)[]) {
      const value = Number((parsed as any)[key]);
      if (Number.isFinite(value)) merged[key] = value;
    }
    return merged;
  } catch {
    return DEFAULT_COMMISSION_PARAMS;
  }
}

const DEFAULT_GATEWAY_FEE_PCT = 0.07;
const FINANCE_COMMISSION_ROLES = ["sales_agent", "sales_manager", "tele_sales_agent", "tele_sales_manager"];
const BOOKED_MEETING_STATUS = "Accept and book meeting";

export async function loadCommissionConfig(): Promise<{
  tiers: CommissionTier[];
  gatewayFeePct: number;
  rules: {
    salesAgentTiers: FlatTier[];
    salesTeamLeaderTiers: FlatTier[];
    telesalesColdTiers: FlatTier[];
    telesalesManagerRates: FlatTier[];
  };
  params: CommissionParams;
}> {
  const [tiersConfig, feeConfig, agentCfg, tlCfg, coldCfg, mgrCfg, paramsCfg] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: "commission_tiers" } }),
    prisma.systemConfig.findUnique({ where: { key: "gateway_fee_pct" } }),
    prisma.systemConfig.findUnique({ where: { key: COMMISSION_RATE_KEYS.salesAgentTiers } }),
    prisma.systemConfig.findUnique({ where: { key: COMMISSION_RATE_KEYS.salesTeamLeaderTiers } }),
    prisma.systemConfig.findUnique({ where: { key: COMMISSION_RATE_KEYS.telesalesColdTiers } }),
    prisma.systemConfig.findUnique({ where: { key: COMMISSION_RATE_KEYS.telesalesManagerRates } }),
    prisma.systemConfig.findUnique({ where: { key: COMMISSION_PARAMS_KEY } }),
  ]);

  let tiers: CommissionTier[] = DEFAULT_TIERS;
  if (tiersConfig?.value) {
    const parsed = parseCommissionTiers(tiersConfig.value) as CommissionTier[];
    if (parsed.length > 0) tiers = parsed;
  }

  let gatewayFeePct = DEFAULT_GATEWAY_FEE_PCT;
  if (feeConfig?.value) {
    const parsed = parseFloat(feeConfig.value);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed < 1) gatewayFeePct = parsed;
  }

  return {
    tiers,
    gatewayFeePct,
    rules: {
      salesAgentTiers: parseFlatTiers(agentCfg?.value, SALES_AGENT_TIERS),
      salesTeamLeaderTiers: parseFlatTiers(tlCfg?.value, SALES_TEAM_LEADER_TIERS),
      telesalesColdTiers: parseFlatTiers(coldCfg?.value, TELESALES_COLD_TIERS),
      telesalesManagerRates: parseFlatTiers(mgrCfg?.value, DEFAULT_TELESALES_MANAGER_RATES),
    },
    params: parseCommissionParams(paramsCfg?.value),
  };
}

export function commissionFromNet(net: number, tiers: CommissionTier[]): { amount: number; effectivePct: number } {
  if (net <= 0) return { amount: 0, effectivePct: 0 };
  const tier = tierForValue(net, tiers.map((t, i) => ({
    tier: i + 1,
    label: `Tier ${i + 1}`,
    min: t.minNet,
    max: t.maxNet,
    pct: t.pct,
  })));
  const amount = round2(net * tier.pct);
  return { amount, effectivePct: tier.pct };
}

export function achievementMultiplier(achievementPct: number): number {
  if (achievementPct >= 150) return 1.5;
  if (achievementPct >= 125) return 1.25;
  if (achievementPct >= 100) return 1.0;
  return Math.max(0, achievementPct / 100);
}

export function sumLineItems(json: string | null): number {
  if (!json) return 0;
  return sumFinanceLineItems(json);
}

export function computeSalesAgentCommission(
  deals: DealForCommission[],
  gatewayFeePct = DEFAULT_GATEWAY_FEE_PCT,
  salesAgentTiers: FlatTier[] = SALES_AGENT_TIERS,
  params: CommissionParams = DEFAULT_COMMISSION_PARAMS
): CommissionBreakdown {
  const rows = deals.map((deal) => classifyDeal(deal, gatewayFeePct));

  const standardTierRows = rows.filter((row) => !row.isVip && row.dealType !== "hunt");
  const standardHuntRows = rows.filter((row) => !row.isVip && row.dealType === "hunt");
  const vipRows = rows.filter((row) => row.isVip);
  const standardColdRows = standardTierRows.filter((row) => row.dealType === "cold");

  const standardGrossFund = sumRows(standardTierRows, "gross");
  const standardNetBase = sumRows(standardTierRows, "net");
  const tier = tierForValue(standardGrossFund, salesAgentTiers);
  const standardCommission = round2(standardNetBase * tier.pct);
  const coldBonus = round2(sumRows(standardColdRows, "net") * params.salesColdExtraPct);
  const huntCommission = round2(sumRows(standardHuntRows, "net") * params.salesHuntPct);

  let vipCommission = 0;
  let vipHotNet = 0;
  let vipColdNet = 0;
  let vipHuntNet = 0;
  for (const row of vipRows) {
    const pct = row.dealType === "hunt" ? params.salesVipHuntPct : row.dealType === "cold" ? params.salesVipColdPct : params.salesVipHotPct;
    vipCommission += row.net * pct;
    if (row.dealType === "hunt") vipHuntNet += row.net;
    else if (row.dealType === "cold") vipColdNet += row.net;
    else vipHotNet += row.net;
  }

  const netCommissionBase = sumRows(rows, "net");
  const gatewayFees = round2(sumRows(rows, "gross") - netCommissionBase);
  const commissionAmount = round2(standardCommission + coldBonus + huntCommission + vipCommission);

  return {
    plan: "sales_agent",
    planLabel: "Sales Agent",
    grossFund: round2(standardGrossFund),
    netCommissionBase: round2(netCommissionBase),
    gatewayFees,
    tierLabel: standardGrossFund > 0 ? tier.label : "No standard tier",
    tierPct: standardGrossFund > 0 ? tier.pct : 0,
    commissionAmount,
    targetBonus: 0,
    metrics: {
      deals: rows.length,
      standardDeals: standardTierRows.length,
      standardColdDeals: standardColdRows.length,
      standardHuntDeals: standardHuntRows.length,
      vipDeals: vipRows.length,
      vipHotNet: round2(vipHotNet),
      vipColdNet: round2(vipColdNet),
      vipHuntNet: round2(vipHuntNet),
    },
    components: [
      { label: "Standard tier commission", amount: standardCommission, pct: tier.pct },
      { label: "Standard Cold extra bonus", amount: coldBonus, pct: params.salesColdExtraPct },
      { label: "Standard Hunt fixed commission", amount: huntCommission, pct: params.salesHuntPct },
      { label: "VIP commission", amount: round2(vipCommission) },
    ],
    notes: [
      "Standard tier uses gross fund before Tabby/Tamara fees.",
      "Percentages are applied to net values after gateway fees.",
      "Refund deductions are manual until refund records are stored per deal.",
    ],
  };
}

export function computeSalesTeamLeaderCommission(input: {
  teamDeals: DealForCommission[];
  personalDeals: DealForCommission[];
  monthlyTarget: number;
  gatewayFeePct?: number;
  salesTeamLeaderTiers?: FlatTier[];
  salesAgentTiers?: FlatTier[];
  params?: CommissionParams;
}): CommissionBreakdown {
  const gatewayFeePct = input.gatewayFeePct ?? DEFAULT_GATEWAY_FEE_PCT;
  const params = input.params ?? DEFAULT_COMMISSION_PARAMS;
  const teamRows = input.teamDeals.map((deal) => classifyDeal(deal, gatewayFeePct));
  const personalRows = input.personalDeals.map((deal) => classifyDeal(deal, gatewayFeePct));
  const teamGross = sumRows(teamRows, "gross");
  const personalGross = sumRows(personalRows, "gross");
  const teamNet = sumRows(teamRows, "net");
  const personalNet = sumRows(personalRows, "net");
  const tierFund = teamGross + personalGross;
  const tier = tierForValue(tierFund, input.salesTeamLeaderTiers ?? SALES_TEAM_LEADER_TIERS);
  const teamOverride = round2(teamNet * tier.pct);
  const personalCommission = computeSalesAgentCommission(input.personalDeals, gatewayFeePct, input.salesAgentTiers ?? SALES_AGENT_TIERS, params).commissionAmount;
  const achievementPct = input.monthlyTarget > 0 ? (tierFund / input.monthlyTarget) * 100 : 0;
  const targetBonus = round2(tierFund * salesTeamLeaderTargetBonusPct(achievementPct, params));
  const commissionAmount = round2(teamOverride + personalCommission);
  const netCommissionBase = round2(teamNet + personalNet);

  return {
    plan: "sales_team_leader",
    planLabel: "Sales Team Leader",
    grossFund: round2(tierFund),
    netCommissionBase,
    gatewayFees: round2(teamGross + personalGross - netCommissionBase),
    tierLabel: tierFund > 0 ? tier.label : "No team tier",
    tierPct: tierFund > 0 ? tier.pct : 0,
    commissionAmount,
    targetBonus,
    metrics: {
      teamDeals: teamRows.length,
      personalDeals: personalRows.length,
      teamNet: round2(teamNet),
      personalNet: round2(personalNet),
      monthlyTarget: round2(input.monthlyTarget),
      targetAchievementPct: round2(achievementPct),
    },
    components: [
      { label: "Team override commission", amount: teamOverride, pct: tier.pct },
      { label: "Personal sales commission", amount: personalCommission },
      { label: "Target cash bonus", amount: targetBonus },
    ],
    notes: [
      "Personal deals lift the team leader tier but do not receive team override.",
      "Personal deals are calculated with the Sales Agent rules.",
      "Target bonus is stored as an automatic bonus line item.",
    ],
  };
}

export function computeTelesalesAgentCommission(input: {
  deals: DealForCommission[];
  meetingsBooked: number;
  meetingsTarget: number;
  gatewayFeePct?: number;
  telesalesColdTiers?: FlatTier[];
  params?: CommissionParams;
}): CommissionBreakdown {
  const gatewayFeePct = input.gatewayFeePct ?? DEFAULT_GATEWAY_FEE_PCT;
  const params = input.params ?? DEFAULT_COMMISSION_PARAMS;
  const rows = input.deals.map((deal) => classifyDeal(deal, gatewayFeePct));
  const standardColdRows = rows.filter((row) => !row.isVip && row.dealType === "cold");
  const standardHotRows = rows.filter((row) => !row.isVip && row.dealType !== "cold");
  const vipColdRows = rows.filter((row) => row.isVip && row.dealType === "cold");
  const vipHotRows = rows.filter((row) => row.isVip && row.dealType !== "cold");

  const coldTier = tierForValue(standardColdRows.length, input.telesalesColdTiers ?? TELESALES_COLD_TIERS);
  const standardColdCommission = round2(sumRows(standardColdRows, "net") * coldTier.pct);
  const standardHotCommission = round2(sumRows(standardHotRows, "net") * params.telesalesHotPct);
  const vipColdCommission = round2(sumRows(vipColdRows, "net") * params.telesalesVipColdPct);
  const vipHotCommission = round2(sumRows(vipHotRows, "net") * params.telesalesVipHotPct);
  const targetAchievementPct =
    input.meetingsTarget > 0 ? (input.meetingsBooked / input.meetingsTarget) * 100 : 0;
  const targetBonus = telesalesTargetBonus(input.meetingsBooked, input.meetingsTarget, params);
  const commissionAmount = round2(
    standardColdCommission + standardHotCommission + vipColdCommission + vipHotCommission
  );
  const grossTotal = sumRows(rows, "gross");
  const netCommissionBase = sumRows(rows, "net");

  return {
    plan: "telesales_agent",
    planLabel: "TeleSales Agent",
    grossFund: round2(grossTotal),
    netCommissionBase: round2(netCommissionBase),
    gatewayFees: round2(grossTotal - netCommissionBase),
    tierLabel: standardColdRows.length > 0 ? coldTier.label : "No cold deals",
    tierPct: standardColdRows.length > 0 ? coldTier.pct : 0,
    commissionAmount,
    targetBonus,
    metrics: {
      standardColdDeals: standardColdRows.length,
      standardHotDeals: standardHotRows.length,
      vipColdDeals: vipColdRows.length,
      vipHotDeals: vipHotRows.length,
      meetingsBooked: input.meetingsBooked,
      meetingsTarget: input.meetingsTarget,
      targetAchievementPct: round2(targetAchievementPct),
    },
    components: [
      { label: "Standard Cold commission", amount: standardColdCommission, pct: coldTier.pct },
      { label: "Standard Hot commission", amount: standardHotCommission, pct: params.telesalesHotPct },
      { label: "VIP Cold commission", amount: vipColdCommission, pct: params.telesalesVipColdPct },
      { label: "VIP Hot commission", amount: vipHotCommission, pct: params.telesalesVipHotPct },
      { label: "Target fixed bonus", amount: targetBonus },
    ],
    notes: [
      "Cold tier is based on Standard Cold deal count.",
      "Percentages are applied to net deal values after gateway fees.",
      "Target bonus is stored as an automatic bonus line item.",
    ],
  };
}

export function computeTelesalesManagerCommission(input: {
  deals: DealForCommission[];
  coldMeetingsPerAgent: number;
  hotMeetings: number;
  totalLeads: number;
  gatewayFeePct?: number;
  telesalesManagerRates?: FlatTier[];
  params?: CommissionParams;
}): CommissionBreakdown {
  const gatewayFeePct = input.gatewayFeePct ?? DEFAULT_GATEWAY_FEE_PCT;
  const params = input.params ?? DEFAULT_COMMISSION_PARAMS;
  const rows = input.deals.map((deal) => classifyDeal(deal, gatewayFeePct));
  const grossFund = sumRows(rows, "gross");
  const netCommissionBase = sumRows(rows, "net");
  const hotConversionRate = input.totalLeads > 0 ? (input.hotMeetings / input.totalLeads) * 100 : 0;
  const coldTier = telesalesManagerColdTier(input.coldMeetingsPerAgent, params);
  const hotTier = telesalesManagerHotTier(hotConversionRate, params);
  const finalTierNumber = Math.min(coldTier.tier, hotTier.tier);
  const finalTier =
    input.telesalesManagerRates?.find((rate) => rate.tier === finalTierNumber) ??
    telesalesManagerRateTier(finalTierNumber);
  const commissionAmount = round2(netCommissionBase * finalTier.pct);

  return {
    plan: "telesales_manager",
    planLabel: "TeleSales Manager",
    grossFund: round2(grossFund),
    netCommissionBase: round2(netCommissionBase),
    gatewayFees: round2(grossFund - netCommissionBase),
    tierLabel: finalTier.label,
    tierPct: finalTier.pct,
    commissionAmount,
    targetBonus: 0,
    metrics: {
      closedDeals: rows.length,
      coldMeetingsPerAgent: round2(input.coldMeetingsPerAgent),
      coldTier: coldTier.tier,
      hotMeetings: input.hotMeetings,
      totalLeads: input.totalLeads,
      hotConversionRate: round2(hotConversionRate),
      hotTier: hotTier.tier,
      finalTier: finalTierNumber,
    },
    components: [
      { label: "Manager commission", amount: commissionAmount, pct: finalTier.pct },
    ],
    notes: [
      "Final manager tier uses the lower achieved tier across Cold and Hot metrics.",
      "Commission is applied to net team revenue after gateway fees.",
    ],
  };
}

export async function recomputeMonth(month: string) {
  const { start, end } = monthDateRange(month);
  const { gatewayFeePct, rules, params } = await loadCommissionConfig();

  const [salesAgents, salesManagers] = await Promise.all([
    prisma.user.findMany({ where: { role: "sales_agent" }, include: { hrRecord: true } }),
    prisma.user.findMany({ where: { role: "sales_manager" }, include: { hrRecord: true } }),
  ]);

  const results: any[] = [];

  for (const agent of salesAgents) {
    const deals = await prisma.deal.findMany({
      where: {
        salesAgentId: agent.id,
        createdAt: { gte: start, lt: end },
        status: "Closed_Won",
      },
      include: { lead: { select: { classification: true, customerType: true } } },
    });

    const breakdown = computeSalesAgentCommission(deals, gatewayFeePct, rules.salesAgentTiers, params);
    results.push(await upsertCommissionFromBreakdown(agent, month, breakdown));
  }

  for (const manager of salesManagers) {
    const [teamDeals, personalDeals] = await Promise.all([
      prisma.deal.findMany({
        where: {
          createdAt: { gte: start, lt: end },
          status: "Closed_Won",
          salesAgent: { is: { directManagerId: manager.id } },
        },
        include: { lead: { select: { classification: true, customerType: true } } },
      }),
      prisma.deal.findMany({
        where: {
          salesAgentId: manager.id,
          createdAt: { gte: start, lt: end },
          status: "Closed_Won",
        },
        include: { lead: { select: { classification: true, customerType: true } } },
      }),
    ]);

    const breakdown = computeSalesTeamLeaderCommission({
      teamDeals,
      personalDeals,
      monthlyTarget: manager.hrRecord?.monthlyTarget ?? 0,
      gatewayFeePct,
      salesTeamLeaderTiers: rules.salesTeamLeaderTiers,
      salesAgentTiers: rules.salesAgentTiers,
      params,
    });
    results.push(await upsertCommissionFromBreakdown(manager, month, breakdown));
  }

  return results;
}

export async function recomputeTelesalesBonuses(month: string) {
  const { start, end } = monthDateRange(month);
  const { gatewayFeePct, rules, params } = await loadCommissionConfig();

  const [agents, managers] = await Promise.all([
    prisma.user.findMany({ where: { role: "tele_sales_agent" }, include: { hrRecord: true } }),
    prisma.user.findMany({ where: { role: "tele_sales_manager" }, include: { hrRecord: true } }),
  ]);

  const results: any[] = [];

  for (const agent of agents) {
    const [deals, meetingsBooked, targetRow] = await Promise.all([
      prisma.deal.findMany({
        where: {
          status: "Closed_Won",
          createdAt: { gte: start, lt: end },
          lead: { assignedTeleAgentId: agent.id },
        },
        include: { lead: { select: { classification: true, customerType: true } } },
      }),
      prisma.callLog.count({
        where: {
          agentId: agent.id,
          callStatus: BOOKED_MEETING_STATUS,
          createdAt: { gte: start, lt: end },
        },
      }),
      prisma.agentTarget.findUnique({
        where: { agentId_month: { agentId: agent.id, month } },
      }),
    ]);

    const meetingsTarget = targetRow?.target ?? agent.hrRecord?.monthlyTarget ?? 0;
    const breakdown = computeTelesalesAgentCommission({
      deals,
      meetingsBooked,
      meetingsTarget,
      gatewayFeePct,
      telesalesColdTiers: rules.telesalesColdTiers,
      params,
    });
    results.push(await upsertCommissionFromBreakdown(agent, month, breakdown));
  }

  for (const manager of managers) {
    const teamAgents = await prisma.user.findMany({
      where: { role: "tele_sales_agent", directManagerId: manager.id },
      select: { id: true },
    });
    const teamAgentIds = teamAgents.map((agent) => agent.id);

    let deals: DealForCommission[] = [];
    let bookedMeetings = 0;
    let hotMeetings = 0;
    let totalLeads = 0;
    if (teamAgentIds.length) {
      [deals, bookedMeetings, hotMeetings, totalLeads] = await Promise.all([
        prisma.deal.findMany({
          where: {
            status: "Closed_Won",
            createdAt: { gte: start, lt: end },
            lead: { assignedTeleAgentId: { in: teamAgentIds } },
          },
          include: { lead: { select: { classification: true, customerType: true } } },
        }),
        prisma.callLog.count({
          where: {
            agentId: { in: teamAgentIds },
            callStatus: BOOKED_MEETING_STATUS,
            createdAt: { gte: start, lt: end },
          },
        }),
        prisma.callLog.count({
          where: {
            agentId: { in: teamAgentIds },
            callStatus: BOOKED_MEETING_STATUS,
            createdAt: { gte: start, lt: end },
            lead: { classification: "Hot" },
          },
        }),
        prisma.lead.count({
          where: {
            assignedTeleAgentId: { in: teamAgentIds },
            createdAt: { gte: start, lt: end },
          },
        }),
      ]);
    }

    const breakdown = computeTelesalesManagerCommission({
      deals,
      coldMeetingsPerAgent: teamAgentIds.length ? bookedMeetings / teamAgentIds.length : 0,
      hotMeetings,
      totalLeads,
      gatewayFeePct,
      telesalesManagerRates: rules.telesalesManagerRates,
      params,
    });
    results.push(await upsertCommissionFromBreakdown(manager, month, breakdown));
  }

  return results;
}

export async function buildCommissionBreakdownForUserMonth(input: {
  userId: string;
  role?: string | null;
  month: string;
}): Promise<CommissionBreakdown | null> {
  if (!input.role || !FINANCE_COMMISSION_ROLES.includes(input.role)) return null;

  const { start, end } = monthDateRange(input.month);
  const { gatewayFeePct, rules, params } = await loadCommissionConfig();

  if (input.role === "sales_agent") {
    const deals = await prisma.deal.findMany({
      where: { salesAgentId: input.userId, createdAt: { gte: start, lt: end }, status: "Closed_Won" },
      include: { lead: { select: { classification: true, customerType: true } } },
    });
    return computeSalesAgentCommission(deals, gatewayFeePct, rules.salesAgentTiers, params);
  }

  if (input.role === "sales_manager") {
    const [manager, teamDeals, personalDeals] = await Promise.all([
      prisma.user.findUnique({ where: { id: input.userId }, include: { hrRecord: true } }),
      prisma.deal.findMany({
        where: {
          createdAt: { gte: start, lt: end },
          status: "Closed_Won",
          salesAgent: { is: { directManagerId: input.userId } },
        },
        include: { lead: { select: { classification: true, customerType: true } } },
      }),
      prisma.deal.findMany({
        where: { salesAgentId: input.userId, createdAt: { gte: start, lt: end }, status: "Closed_Won" },
        include: { lead: { select: { classification: true, customerType: true } } },
      }),
    ]);
    return computeSalesTeamLeaderCommission({
      teamDeals,
      personalDeals,
      monthlyTarget: manager?.hrRecord?.monthlyTarget ?? 0,
      gatewayFeePct,
      salesTeamLeaderTiers: rules.salesTeamLeaderTiers,
      salesAgentTiers: rules.salesAgentTiers,
      params,
    });
  }

  if (input.role === "tele_sales_agent") {
    const [agent, deals, meetingsBooked, targetRow] = await Promise.all([
      prisma.user.findUnique({ where: { id: input.userId }, include: { hrRecord: true } }),
      prisma.deal.findMany({
        where: {
          status: "Closed_Won",
          createdAt: { gte: start, lt: end },
          lead: { assignedTeleAgentId: input.userId },
        },
        include: { lead: { select: { classification: true, customerType: true } } },
      }),
      prisma.callLog.count({
        where: {
          agentId: input.userId,
          callStatus: BOOKED_MEETING_STATUS,
          createdAt: { gte: start, lt: end },
        },
      }),
      prisma.agentTarget.findUnique({
        where: { agentId_month: { agentId: input.userId, month: input.month } },
      }),
    ]);
    return computeTelesalesAgentCommission({
      deals,
      meetingsBooked,
      meetingsTarget: targetRow?.target ?? agent?.hrRecord?.monthlyTarget ?? 0,
      gatewayFeePct,
      telesalesColdTiers: rules.telesalesColdTiers,
      params,
    });
  }

  const teamAgents = await prisma.user.findMany({
    where: { role: "tele_sales_agent", directManagerId: input.userId },
    select: { id: true },
  });
  const teamAgentIds = teamAgents.map((agent) => agent.id);

  let deals: DealForCommission[] = [];
  let bookedMeetings = 0;
  let hotMeetings = 0;
  let totalLeads = 0;
  if (teamAgentIds.length) {
    [deals, bookedMeetings, hotMeetings, totalLeads] = await Promise.all([
      prisma.deal.findMany({
        where: {
          status: "Closed_Won",
          createdAt: { gte: start, lt: end },
          lead: { assignedTeleAgentId: { in: teamAgentIds } },
        },
        include: { lead: { select: { classification: true, customerType: true } } },
      }),
      prisma.callLog.count({
        where: {
          agentId: { in: teamAgentIds },
          callStatus: BOOKED_MEETING_STATUS,
          createdAt: { gte: start, lt: end },
        },
      }),
      prisma.callLog.count({
        where: {
          agentId: { in: teamAgentIds },
          callStatus: BOOKED_MEETING_STATUS,
          createdAt: { gte: start, lt: end },
          lead: { classification: "Hot" },
        },
      }),
      prisma.lead.count({
        where: {
          assignedTeleAgentId: { in: teamAgentIds },
          createdAt: { gte: start, lt: end },
        },
      }),
    ]);
  }

  return computeTelesalesManagerCommission({
    deals,
    coldMeetingsPerAgent: teamAgentIds.length ? bookedMeetings / teamAgentIds.length : 0,
    hotMeetings,
    totalLeads,
    gatewayFeePct,
    telesalesManagerRates: rules.telesalesManagerRates,
    params,
  });
}

async function upsertCommissionFromBreakdown(
  user: UserWithHr,
  month: string,
  breakdown: CommissionBreakdown
) {
  const existing = await prisma.commission.findFirst({ where: { userId: user.id, month } });
  if (existing?.finalized) return existing;

  const autoBonusItems = buildAutoBonusItems(breakdown);
  const mergedBonuses = mergeAutoBonuses(existing?.bonuses ?? null, autoBonusItems);
  const bonusesJson = stringifyFinanceLineItems(mergedBonuses);
  const deductionsJson = existing?.deductions ?? "[]";
  const baseSalary = user.hrRecord?.baseSalary ?? 0;
  const bonusesSum = sumLineItems(bonusesJson);
  const deductionsSum = sumLineItems(deductionsJson);
  const netPayout = round2(baseSalary + breakdown.commissionAmount + bonusesSum - deductionsSum);
  const effectivePct =
    breakdown.netCommissionBase > 0 ? round2(breakdown.commissionAmount / breakdown.netCommissionBase) : 0;

  const data = {
    netTarget: breakdown.netCommissionBase,
    commissionPct: effectivePct,
    commissionAmount: breakdown.commissionAmount,
    bonuses: bonusesJson,
    deductions: deductionsJson,
    netPayout,
  };

  if (existing) {
    return prisma.commission.update({ where: { id: existing.id }, data });
  }

  return prisma.commission.create({
    data: {
      userId: user.id,
      month,
      ...data,
      finalized: false,
    },
  });
}

function buildAutoBonusItems(breakdown: CommissionBreakdown): BonusItem[] {
  if (breakdown.targetBonus <= 0) return [];
  return [
    {
      reason: `${breakdown.planLabel} target bonus`,
      amount: breakdown.targetBonus,
      auto: true,
    },
  ];
}

function classifyDeal(deal: DealForCommission, gatewayFeePct: number) {
  const gross = Math.max(0, Number(deal.totalAmount) || 0);
  const net = netDealAmount(deal, gatewayFeePct);
  return {
    gross,
    net,
    isVip: isVipCustomer(deal.lead?.customerType),
    dealType: dealType(deal),
  };
}

function netDealAmount(deal: DealForCommission, gatewayFeePct: number): number {
  const gross = Math.max(0, Number(deal.totalAmount) || 0);
  const storedNet = Number(deal.netTarget);
  if (Number.isFinite(storedNet) && storedNet > 0) return round2(storedNet);
  const paymentMethod = String(deal.paymentMethod || "").toLowerCase();
  if (paymentMethod === "tabby" || paymentMethod === "tamara") return round2(gross * (1 - gatewayFeePct));
  return round2(gross);
}

function isVipCustomer(customerType?: string | null): boolean {
  const normalized = String(customerType || "").trim().toLowerCase();
  return normalized === "vip" || normalized === "special" || normalized.includes("vip");
}

function dealType(deal: DealForCommission): "cold" | "hot" | "hunt" | "regular" {
  const values = [deal.lead?.classification, deal.package].map((value) => String(value || "").toLowerCase());
  if (values.some((value) => value.includes("hunt"))) return "hunt";
  if (values.some((value) => value.includes("cold"))) return "cold";
  if (values.some((value) => value.includes("hot"))) return "hot";
  return "regular";
}

function tierForValue(value: number, tiers: FlatTier[]): FlatTier {
  for (const tier of tiers) {
    const upper = tier.max ?? Infinity;
    if (value >= tier.min && value <= upper) return tier;
  }
  return tiers[0];
}

function salesTeamLeaderTargetBonusPct(achievementPct: number, params: CommissionParams = DEFAULT_COMMISSION_PARAMS): number {
  if (achievementPct >= params.tlTargetBonusFullThreshold) return params.tlTargetBonusFullPct;
  if (achievementPct >= params.tlTargetBonusPartialThreshold) return params.tlTargetBonusPartialPct;
  return 0;
}

function telesalesTargetBonus(meetingsBooked: number, meetingsTarget: number, params: CommissionParams = DEFAULT_COMMISSION_PARAMS): number {
  if (meetingsTarget <= 0) return 0;
  const achievementPct = (meetingsBooked / meetingsTarget) * 100;
  if (achievementPct >= params.telesalesTargetBonusHighThreshold) return params.telesalesTargetBonusHigh;
  if (meetingsBooked === meetingsTarget) return params.telesalesTargetBonusExact;
  if (achievementPct > 100) return params.telesalesTargetBonusOver;
  return 0;
}

function telesalesManagerColdTier(coldMeetingsPerAgent: number, params: CommissionParams = DEFAULT_COMMISSION_PARAMS): FlatTier {
  if (coldMeetingsPerAgent >= params.mgrColdTier3Min) return { tier: 3, label: "Cold Tier 3", min: params.mgrColdTier3Min, max: null, pct: 0.0075 };
  if (coldMeetingsPerAgent >= params.mgrColdTier2Min) return { tier: 2, label: "Cold Tier 2", min: params.mgrColdTier2Min, max: params.mgrColdTier3Min - 1, pct: 0.005 };
  return { tier: 1, label: "Cold Tier 1", min: 0, max: params.mgrColdTier2Min - 1, pct: 0.0025 };
}

function telesalesManagerHotTier(hotConversionRate: number, params: CommissionParams = DEFAULT_COMMISSION_PARAMS): FlatTier {
  if (hotConversionRate >= params.mgrHotTier3Min) return { tier: 3, label: "Hot Tier 3", min: params.mgrHotTier3Min, max: null, pct: 0.0075 };
  if (hotConversionRate >= params.mgrHotTier2Min) return { tier: 2, label: "Hot Tier 2", min: params.mgrHotTier2Min, max: params.mgrHotTier3Min - 0.1, pct: 0.005 };
  return { tier: 1, label: "Hot Tier 1", min: 0, max: params.mgrHotTier2Min - 0.1, pct: 0.0025 };
}

function telesalesManagerRateTier(tierNumber: number): FlatTier {
  if (tierNumber >= 3) return { tier: 3, label: "TeleSales Manager Tier 3", min: 3, max: 3, pct: 0.0075 };
  if (tierNumber >= 2) return { tier: 2, label: "TeleSales Manager Tier 2", min: 2, max: 2, pct: 0.005 };
  return { tier: 1, label: "TeleSales Manager Tier 1", min: 1, max: 1, pct: 0.0025 };
}

function sumRows(rows: { gross: number; net: number }[], field: "gross" | "net") {
  return rows.reduce((sum, row) => sum + row[field], 0);
}

function monthDateRange(month: string) {
  const [year, mm] = month.split("-").map((s) => parseInt(s, 10));
  if (!year || !mm) throw new Error(`Invalid month: ${month}`);
  return {
    start: new Date(year, mm - 1, 1),
    end: new Date(year, mm, 1),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
