import { describe, expect, it } from "vitest";
import { resolveManualLeadAssigneeId } from "../manualLeadAssignment";

describe("resolveManualLeadAssigneeId", () => {
  it("assigns manual leads created by telesales agents to themselves", () => {
    expect(
      resolveManualLeadAssigneeId({
        creatorId: "agent-1",
        creatorRole: "tele_sales_agent",
        requestedTeleAgentId: "someone-else",
      }),
    ).toBe("agent-1");
  });

  it("does not treat a telesales manager as their own assignee", () => {
    expect(
      resolveManualLeadAssigneeId({
        creatorId: "manager-1",
        creatorRole: "tele_sales_manager",
        requestedTeleAgentId: "manager-1",
      }),
    ).toBeNull();
  });

  it("keeps explicit team-agent assignments from managers", () => {
    expect(
      resolveManualLeadAssigneeId({
        creatorId: "manager-1",
        creatorRole: "tele_sales_manager",
        requestedTeleAgentId: "agent-1",
      }),
    ).toBe("agent-1");
  });
});
