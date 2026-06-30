import { describe, expect, it } from "vitest";
import {
  chooseFirstAvailableByOrder,
  isAgentPresent,
  resolveDistributionCompanyId,
  type RotationAgent,
} from "../autoAssign";

// Three agents in a fixed priority order: s1 (earliest) → s2 → s3.
const cycle = (overrides: Partial<Record<"s1" | "s2" | "s3", boolean>> = {}): RotationAgent[] => [
  { id: "s1", order: 1, available: overrides.s1 ?? true },
  { id: "s2", order: 2, available: overrides.s2 ?? true },
  { id: "s3", order: 3, available: overrides.s3 ?? true },
];

describe("priority-order meeting distribution", () => {
  it("always prefers the first agent when everyone is free", () => {
    expect(chooseFirstAvailableByOrder(cycle())?.id).toBe("s1");
  });

  it("flows to the next agent in order only while earlier ones are busy", () => {
    // s1 in a meeting → s2 is next; s1 & s2 busy → s3 gets it.
    expect(chooseFirstAvailableByOrder(cycle({ s1: false }))?.id).toBe("s2");
    expect(chooseFirstAvailableByOrder(cycle({ s1: false, s2: false }))?.id).toBe("s3");
  });

  it("returns to the first agent the moment they are free again", () => {
    // Unlike round-robin, an earlier agent who frees up jumps back to the front.
    expect(chooseFirstAvailableByOrder(cycle({ s2: false }))?.id).toBe("s1");
    expect(chooseFirstAvailableByOrder(cycle({ s2: false, s3: false }))?.id).toBe("s1");
  });

  it("is NOT equal distribution — order is respected regardless of position", () => {
    // Even if only the last agent is free, they get it; otherwise s1 wins.
    expect(chooseFirstAvailableByOrder(cycle({ s1: false, s2: false }))?.id).toBe("s3");
    expect(chooseFirstAvailableByOrder(cycle())?.id).toBe("s1");
  });

  it("returns null when every agent is checked out / absent / busy", () => {
    expect(chooseFirstAvailableByOrder(cycle({ s1: false, s2: false, s3: false }))).toBeNull();
  });

  it("returns null for an empty roster", () => {
    expect(chooseFirstAvailableByOrder([])).toBeNull();
  });
});

describe("attendance-based availability", () => {
  it("is present after check-in", () => {
    expect(isAgentPresent({ checkIn: new Date(), checkOut: null })).toBe(true);
  });

  it("is NOT present once checked out", () => {
    expect(isAgentPresent({ checkIn: new Date(), checkOut: new Date() })).toBe(false);
  });

  it("is NOT present when never checked in (absent / no record)", () => {
    expect(isAgentPresent({ checkIn: null, checkOut: null })).toBe(false);
    expect(isAgentPresent(null)).toBe(false);
    expect(isAgentPresent(undefined)).toBe(false);
  });
});

describe("lead distribution company scoping", () => {
  it("uses the lead's own company when set", () => {
    expect(
      resolveDistributionCompanyId({ companyId: "A", assignedTeleAgentId: "t1" }, "B")
    ).toBe("A");
  });

  it("falls back to the telesales agent's company when the lead has none", () => {
    expect(
      resolveDistributionCompanyId({ companyId: null, assignedTeleAgentId: "t1" }, "A")
    ).toBe("A");
  });

  it("a tele agent in company A never scopes to another company", () => {
    const company = resolveDistributionCompanyId(
      { companyId: null, assignedTeleAgentId: "tele-in-A" },
      "A"
    );
    expect(company).toBe("A");
    expect(company).not.toBe("B");
  });

  it("returns null (org-wide) only when neither lead nor tele agent has a company", () => {
    expect(resolveDistributionCompanyId({ companyId: null, assignedTeleAgentId: "t1" }, null)).toBeNull();
    expect(resolveDistributionCompanyId({ companyId: null, assignedTeleAgentId: null }, "A")).toBeNull();
  });
});
