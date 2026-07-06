import { describe, expect, it } from "vitest";
import {
  computeSalesAgentCommission,
  computeSalesTeamLeaderCommission,
  computeTelesalesAgentCommission,
  computeTelesalesManagerCommission,
} from "../commissions";

describe("PDF commission rules", () => {
  it("calculates sales agent standard, cold bonus, VIP, and gateway fee rules", () => {
    const result = computeSalesAgentCommission([
      { totalAmount: 10000, netTarget: 10000, paymentMethod: "Cash", lead: { classification: "Hot", customerType: "Store" } },
      { totalAmount: 10000, netTarget: 9300, paymentMethod: "Tamara", lead: { classification: "Cold", customerType: "Store" } },
      { totalAmount: 10000, netTarget: 10000, paymentMethod: "Cash", lead: { classification: "Cold", customerType: "Special" } },
    ]);

    expect(result.grossFund).toBe(20000);
    expect(result.gatewayFees).toBe(700);
    expect(result.tierPct).toBe(0.02);
    expect(result.commissionAmount).toBeCloseTo(805.75);
  });

  it("calculates sales team leader override without overriding personal deals", () => {
    const result = computeSalesTeamLeaderCommission({
      teamDeals: [
        { totalAmount: 60000, netTarget: 60000, paymentMethod: "Cash", lead: { classification: "Hot", customerType: "Store" } },
      ],
      personalDeals: [
        { totalAmount: 10000, netTarget: 10000, paymentMethod: "Cash", lead: { classification: "Hot", customerType: "Store" } },
      ],
      monthlyTarget: 100000,
    });

    expect(result.grossFund).toBe(70000);
    expect(result.tierPct).toBe(0.01);
    expect(result.targetBonus).toBe(0);
    expect(result.commissionAmount).toBeCloseTo(750);
  });

  it("calculates telesales agent deal percentages and exact 100 percent target bonus", () => {
    const standardColdDeals = Array.from({ length: 5 }, () => ({
      totalAmount: 1000,
      netTarget: 1000,
      paymentMethod: "Cash",
      lead: { classification: "Cold", customerType: "Store" },
    }));

    const result = computeTelesalesAgentCommission({
      deals: [
        ...standardColdDeals,
        { totalAmount: 2000, netTarget: 2000, paymentMethod: "Cash", lead: { classification: "Hot", customerType: "Store" } },
        { totalAmount: 3000, netTarget: 3000, paymentMethod: "Cash", lead: { classification: "Cold", customerType: "Special" } },
        { totalAmount: 4000, netTarget: 4000, paymentMethod: "Cash", lead: { classification: "Hot", customerType: "Special" } },
      ],
      actualMeetings: 10,
      meetingsTarget: 10,
    });

    expect(result.tierPct).toBe(0.0075);
    expect(result.targetBonus).toBe(1500);
    expect(result.commissionAmount).toBeCloseTo(92.5);
  });

  it("calculates telesales manager using the lowest achieved tier", () => {
    const result = computeTelesalesManagerCommission({
      deals: [
        { totalAmount: 100000, netTarget: 93000, paymentMethod: "Tabby", lead: { classification: "Hot", customerType: "Store" } },
      ],
      coldMeetingsPerAgent: 20,
      hotMeetings: 10,
      totalLeads: 20,
    });

    expect(result.metrics.finalTier).toBe(2);
    expect(result.tierPct).toBe(0.005);
    expect(result.commissionAmount).toBeCloseTo(465);
  });
});
