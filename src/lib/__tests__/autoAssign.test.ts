import { describe, expect, it } from "vitest";
import {
  chooseNextAgentRoundRobin,
  isAgentPresent,
  resolveDistributionCompanyId,
  type RotationAgent,
} from "../autoAssign";

// Three agents in a fixed cycle order: s1 (earliest) → s2 → s3.
const cycle = (overrides: Partial<Record<"s1" | "s2" | "s3", boolean>> = {}): RotationAgent[] => [
  { id: "s1", order: 1, available: overrides.s1 ?? true },
  { id: "s2", order: 2, available: overrides.s2 ?? true },
  { id: "s3", order: 3, available: overrides.s3 ?? true },
];

describe("sequential round-robin meeting distribution", () => {
  it("starts at the first agent when nobody has been assigned yet", () => {
    expect(chooseNextAgentRoundRobin(cycle(), null)?.id).toBe("s1");
  });

  it("hands the next meeting to the agent after the last one assigned", () => {
    expect(chooseNextAgentRoundRobin(cycle(), "s1")?.id).toBe("s2");
    expect(chooseNextAgentRoundRobin(cycle(), "s2")?.id).toBe("s3");
  });

  it("wraps back to the first agent after the last in the cycle", () => {
    expect(chooseNextAgentRoundRobin(cycle(), "s3")?.id).toBe("s1");
  });

  it("does NOT load balance — an idle agent does not jump the queue", () => {
    // s1 just got a meeting; even if s3 is totally idle, the next goes to s2.
    expect(chooseNextAgentRoundRobin(cycle(), "s1")?.id).toBe("s2");
  });

  it("skips a busy agent and continues forward to the next free one", () => {
    // After s3, the cycle returns to s1 — but s1 is in a meeting, so s2 gets it.
    expect(chooseNextAgentRoundRobin(cycle({ s1: false }), "s3")?.id).toBe("s2");
  });

  it("reconsiders a previously-skipped agent once their turn comes back around", () => {
    // s1 was busy and skipped (s2 took the lead). Now s1 is free again: after s2
    // comes s3, then on the next turn s1 is picked up again.
    expect(chooseNextAgentRoundRobin(cycle(), "s2")?.id).toBe("s3");
    expect(chooseNextAgentRoundRobin(cycle(), "s3")?.id).toBe("s1");
  });

  it("returns null when every agent is checked out / absent / busy", () => {
    expect(chooseNextAgentRoundRobin(cycle({ s1: false, s2: false, s3: false }), "s1")).toBeNull();
  });

  it("gives the meeting to the only available agent regardless of position", () => {
    expect(chooseNextAgentRoundRobin(cycle({ s1: false, s2: false }), "s1")?.id).toBe("s3");
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
