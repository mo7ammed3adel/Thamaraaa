import { describe, expect, it } from "vitest";
import { getDateRangePreset, isDateInRange } from "../dateRange";

describe("date range helpers", () => {
  it("builds a last-month range from the current month", () => {
    const range = getDateRangePreset("last_month", new Date(2026, 5, 28, 12));

    expect(range).toEqual({ from: "2026-05-01", to: "2026-05-31" });
  });

  it("keeps date range filtering inclusive for the whole end day", () => {
    const range = { from: "2026-06-01", to: "2026-06-28" };

    expect(isDateInRange("2026-06-28T22:30:00", range)).toBe(true);
    expect(isDateInRange("2026-06-29T00:00:00", range)).toBe(false);
  });
});
