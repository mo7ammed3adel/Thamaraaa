import { describe, expect, it } from "vitest";
import { accruedAnnualLeave, buildLeaveSummary, monthsCompleted } from "../leaveAccrual";

describe("leave accrual", () => {
  it("counts whole months worked", () => {
    expect(monthsCompleted("2026-01-15", new Date("2026-06-20"))).toBe(5);
    expect(monthsCompleted("2026-01-15", new Date("2026-06-10"))).toBe(4); // day not reached
  });

  it("accrues nothing during the first 3 months", () => {
    expect(accruedAnnualLeave("2026-04-01", new Date("2026-06-15"))).toBe(0); // ~2 months
  });

  it("accrues 1.75/month after the 3-month gate", () => {
    // 6 months worked → (6 - 3) * 1.75 = 5.25
    expect(accruedAnnualLeave("2026-01-01", new Date("2026-07-01"))).toBe(5.25);
  });

  it("builds a full summary with monthly remote/permission and yearly annual", () => {
    const now = new Date("2026-07-15");
    const requests = [
      { type: "Leave", status: "Approved", startDate: "2026-02-01", days: 2 },
      { type: "Remote", status: "Approved", date: "2026-07-03", days: 1 },
      { type: "Remote", status: "Approved", date: "2026-06-03", days: 1 }, // previous month → not counted
      { type: "Permission", status: "Approved", date: "2026-07-05", duration: "2 Hours" },
    ];
    const s = buildLeaveSummary("2026-01-01", requests, now);
    expect(s.annual.accrued).toBe((6 - 3) * 1.75);
    expect(s.annual.used).toBe(2);
    expect(s.annual.remaining).toBe(s.annual.accrued - 2);
    expect(s.remote.used).toBe(1); // only this month's remote
    expect(s.remote.remaining).toBe(3);
    expect(s.permission.used).toBe(2);
    expect(s.permission.remaining).toBe(4);
    expect(s.eligibleForAnnual).toBe(true);
  });
});
