import { describe, expect, it } from "vitest";
import {
  chooseNextAgentRoundRobin,
  isAgentAvailableForMeeting,
  isAgentPresent,
  resolveDistributionCompanyId,
  summarizeUnavailability,
  type RotationAgent,
} from "../autoAssign";

// Three agents in a fixed cycle order: s1 (earliest) → s2 → s3.
const cycle = (overrides: Partial<Record<"s1" | "s2" | "s3", boolean>> = {}): RotationAgent[] => [
  { id: "s1", order: 1, available: overrides.s1 ?? true },
  { id: "s2", order: 2, available: overrides.s2 ?? true },
  { id: "s3", order: 3, available: overrides.s3 ?? true },
];

describe("round-robin meeting distribution", () => {
  it("starts at the first agent when nobody has been assigned yet", () => {
    expect(chooseNextAgentRoundRobin(cycle(), null)?.id).toBe("s1");
  });

  it("rotates to the next agent after the last one assigned (no priority)", () => {
    expect(chooseNextAgentRoundRobin(cycle(), "s1")?.id).toBe("s2");
    expect(chooseNextAgentRoundRobin(cycle(), "s2")?.id).toBe("s3");
  });

  it("wraps back to the first agent after the last in the cycle", () => {
    expect(chooseNextAgentRoundRobin(cycle(), "s3")?.id).toBe("s1");
  });

  it("does NOT load to one agent — an idle agent does not jump the queue", () => {
    // s1 just got a meeting; even if everyone is free, the next goes to s2.
    expect(chooseNextAgentRoundRobin(cycle(), "s1")?.id).toBe("s2");
  });

  it("skips a busy agent's turn and goes to the next available one", () => {
    // After s3 the cycle returns to s1 — but s1 is busy, so s2 takes this round.
    expect(chooseNextAgentRoundRobin(cycle({ s1: false }), "s3")?.id).toBe("s2");
  });

  it("reconsiders a skipped agent once the rotation comes back around", () => {
    expect(chooseNextAgentRoundRobin(cycle(), "s2")?.id).toBe("s3");
    expect(chooseNextAgentRoundRobin(cycle(), "s3")?.id).toBe("s1");
  });

  it("returns null when every agent is checked out / absent / busy", () => {
    expect(chooseNextAgentRoundRobin(cycle({ s1: false, s2: false, s3: false }), "s1")).toBeNull();
  });

  it("returns null for an empty roster", () => {
    expect(chooseNextAgentRoundRobin([], null)).toBeNull();
  });
});

describe("agent availability for a new meeting", () => {
  const base = { present: true, status: "Active", inStartedMeeting: false };

  it("is available when present, Active, and not inside a meeting", () => {
    expect(isAgentAvailableForMeeting(base)).toBe(true);
  });

  it("is NOT available while inside a started, un-finished meeting", () => {
    expect(isAgentAvailableForMeeting({ ...base, inStartedMeeting: true })).toBe(false);
  });

  it("is NOT available when absent", () => {
    expect(isAgentAvailableForMeeting({ ...base, present: false })).toBe(false);
  });

  it("is NOT available when flagged Busy or In_Call", () => {
    expect(isAgentAvailableForMeeting({ ...base, status: "Busy" })).toBe(false);
    expect(isAgentAvailableForMeeting({ ...base, status: "In_Call" })).toBe(false);
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

describe("unavailability breakdown", () => {
  it("counts each blocker so the manager knows what to fix", () => {
    const summary = summarizeUnavailability([
      { present: false, status: "Active", inStartedMeeting: false },
      { present: false, status: "Active", inStartedMeeting: false },
      { present: true, status: "Busy", inStartedMeeting: false },
      { present: true, status: "Active", inStartedMeeting: true },
      { present: true, status: "Active", inStartedMeeting: false },
    ]);

    expect(summary).toEqual({ total: 5, absent: 2, busy: 1, inMeeting: 1 });
  });

  it("counts an agent blocked by several reasons only once", () => {
    const summary = summarizeUnavailability([
      { present: false, status: "Busy", inStartedMeeting: true },
    ]);

    expect(summary).toEqual({ total: 1, absent: 1, busy: 0, inMeeting: 0 });
  });

  it("reports no blockers when everyone is free", () => {
    const summary = summarizeUnavailability([
      { present: true, status: "Active", inStartedMeeting: false },
    ]);

    expect(summary).toEqual({ total: 1, absent: 0, busy: 0, inMeeting: 0 });
  });
});
