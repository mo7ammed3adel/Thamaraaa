import { describe, expect, it } from "vitest";
import { computePayslip, currentMonth, monthRange } from "../payslip";

describe("payslip", () => {
  it("computes net = base + bonuses - deductions", () => {
    expect(computePayslip({ baseSalary: 5000, bonuses: 800, deductions: 200 })).toEqual({
      baseSalary: 5000,
      bonuses: 800,
      deductions: 200,
      net: 5600,
    });
  });

  it("treats missing bonuses/deductions as zero", () => {
    expect(computePayslip({ baseSalary: 4000 })).toEqual({
      baseSalary: 4000,
      bonuses: 0,
      deductions: 0,
      net: 4000,
    });
  });

  it("never returns a negative net or negative components", () => {
    const slip = computePayslip({ baseSalary: 1000, bonuses: -50, deductions: 5000 });
    expect(slip.net).toBe(0);
    expect(slip.bonuses).toBe(0);
    expect(slip.deductions).toBe(5000);
  });

  it("rounds to two decimals", () => {
    expect(computePayslip({ baseSalary: 1000.005, deductions: 0.1 }).baseSalary).toBe(1000.01);
  });

  it("builds an inclusive-start / exclusive-end month range (UTC)", () => {
    const { start, end } = monthRange("2026-02");
    expect(start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("formats the current month as YYYY-MM", () => {
    expect(currentMonth(new Date("2026-06-09T10:00:00Z"))).toBe("2026-06");
    expect(currentMonth(new Date("2026-11-09T10:00:00Z"))).toBe("2026-11");
  });
});
