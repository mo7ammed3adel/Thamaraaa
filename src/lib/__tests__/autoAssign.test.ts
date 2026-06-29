import { describe, expect, it } from "vitest";
import { resolveDistributionCompanyId } from "../autoAssign";

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
