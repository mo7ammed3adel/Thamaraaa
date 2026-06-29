import { describe, expect, it } from "vitest";
import { chooseSalesAgent, resolveDistributionCompanyId } from "../autoAssign";

describe("meeting distribution to sales (load-balanced)", () => {
  it("spreads to the agent with the fewest active leads", () => {
    const agents = [
      { id: "busy", specialization: "Cold", activeLeads: 3, meetings: 5 },
      { id: "free", specialization: null, activeLeads: 0, meetings: 0 },
    ];
    expect(chooseSalesAgent(agents, "Cold")?.id).toBe("free");
  });

  it("a Cold lead does NOT pile onto the only Cold-specialized agent when others are free", () => {
    // Reproduces the reported bug: salaaaah is Cold-specialized but already loaded;
    // other agents have no meetings → they should get the lead.
    const agents = [
      { id: "salaaaah", specialization: "Cold", activeLeads: 3, meetings: 3 },
      { id: "other1", specialization: null, activeLeads: 0, meetings: 0 },
      { id: "other2", specialization: null, activeLeads: 0, meetings: 0 },
    ];
    expect(chooseSalesAgent(agents, "Cold")?.id).not.toBe("salaaaah");
  });

  it("uses specialization only as a tiebreaker when load is equal", () => {
    const agents = [
      { id: "generic", specialization: null, activeLeads: 0, meetings: 0 },
      { id: "matching", specialization: "Hot", activeLeads: 0, meetings: 0 },
    ];
    expect(chooseSalesAgent(agents, "Hot")?.id).toBe("matching");
  });

  it("returns null when there are no agents", () => {
    expect(chooseSalesAgent([], "Cold")).toBeNull();
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
    // Lead created by a Company A tele agent → only Company A is eligible.
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
