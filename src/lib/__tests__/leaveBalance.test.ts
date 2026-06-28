import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANNUAL_LEAVE_DAYS,
  computeLeaveBalance,
  computeUsedLeaveDays,
  leaveDaysFromDuration,
} from "../leaveBalance";

describe("leave balance", () => {
  it("maps known durations to days", () => {
    expect(leaveDaysFromDuration("1 Day")).toBe(1);
    expect(leaveDaysFromDuration("Half Day")).toBe(0.5);
    expect(leaveDaysFromDuration("1 Week")).toBe(5);
    expect(leaveDaysFromDuration("2 Hours")).toBe(0.25);
  });

  it("parses numeric day/week durations not in the table", () => {
    expect(leaveDaysFromDuration("5 Days")).toBe(5);
    expect(leaveDaysFromDuration("2 Weeks")).toBe(10);
  });

  it("defaults to 1 day for unknown/empty durations", () => {
    expect(leaveDaysFromDuration(undefined)).toBe(1);
    expect(leaveDaysFromDuration("whenever")).toBe(1);
  });

  it("counts only approved Leave-type requests in the given year", () => {
    const requests = [
      { type: "Leave", status: "Approved", date: "2026-02-01", duration: "2 Days" },
      { type: "Leave", status: "Pending", date: "2026-03-01", duration: "3 Days" }, // not approved
      { type: "Remote", status: "Approved", date: "2026-04-01", duration: "1 Day" }, // not leave
      { type: "Leave", status: "Approved", date: "2025-12-01", duration: "5 Days" }, // other year
      { type: "Leave", status: "Approved", date: "2026-06-01", duration: "Half Day" },
    ];
    expect(computeUsedLeaveDays(requests, 2026)).toBe(2.5);
  });

  it("computes remaining balance against the quota", () => {
    const requests = [
      { type: "Leave", status: "Approved", date: "2026-02-01", duration: "1 Week" },
    ];
    const balance = computeLeaveBalance(requests, 2026);
    expect(balance.quota).toBe(DEFAULT_ANNUAL_LEAVE_DAYS);
    expect(balance.used).toBe(5);
    expect(balance.remaining).toBe(DEFAULT_ANNUAL_LEAVE_DAYS - 5);
  });

  it("never returns a negative remaining balance", () => {
    const requests = [
      { type: "Leave", status: "Approved", date: "2026-02-01", duration: "30 Days" },
    ];
    expect(computeLeaveBalance(requests, 2026).remaining).toBe(0);
  });
});
