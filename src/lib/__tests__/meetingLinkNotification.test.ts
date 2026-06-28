import { describe, expect, it } from "vitest";
import { canSalesAgentSendMeetingLink } from "../meetingLinkNotification";

describe("meeting link notifications", () => {
  it("allows a sales agent to send a meeting link to the tele agent on the same lead", () => {
    expect(
      canSalesAgentSendMeetingLink({
        senderRole: "sales_agent",
        senderId: "sales-1",
        recipientId: "tele-1",
        leadAssignedSalesAgentId: "sales-1",
        leadAssignedTeleAgentId: "tele-1",
        hasSafeLink: true,
      }),
    ).toBe(true);
  });

  it("blocks sales agents from sending links to unrelated tele agents", () => {
    expect(
      canSalesAgentSendMeetingLink({
        senderRole: "sales_agent",
        senderId: "sales-1",
        recipientId: "tele-2",
        leadAssignedSalesAgentId: "sales-1",
        leadAssignedTeleAgentId: "tele-1",
        hasSafeLink: true,
      }),
    ).toBe(false);
  });
});
