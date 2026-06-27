import { describe, expect, it } from "vitest";
import { canManuallyDistributeMeeting } from "../meetingDistribution";

describe("canManuallyDistributeMeeting", () => {
  it("allows booked transferred meetings that do not have a sales assignee yet", () => {
    expect(
      canManuallyDistributeMeeting({
        status: "Transferred",
        meetingDate: new Date(),
        assignedSalesAgentId: null,
      }),
    ).toBe(true);
  });

  it("keeps waiting meetings distributable for a retry", () => {
    expect(
      canManuallyDistributeMeeting({
        status: "Waiting",
        meetingDate: new Date(),
        assignedSalesAgentId: null,
      }),
    ).toBe(true);
  });

  it("hides the action when the meeting is already assigned to sales", () => {
    expect(
      canManuallyDistributeMeeting({
        status: "In_Sales",
        meetingDate: new Date(),
        assignedSalesAgentId: "sales-1",
      }),
    ).toBe(false);
  });
});
