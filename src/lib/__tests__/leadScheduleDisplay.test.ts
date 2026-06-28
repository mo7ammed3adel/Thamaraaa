import { describe, expect, it } from "vitest";
import { getLeadFollowUpDisplay, getLeadMeetingDisplay } from "../leadScheduleDisplay";

describe("lead schedule display", () => {
  it("prefers the latest meeting row over the lead meeting fields", () => {
    const display = getLeadMeetingDisplay({
      meetingDate: "2026-06-01T00:00:00.000Z",
      meetingTime: "10:00",
      meetings: [{ meetingDate: "2026-06-28T12:30:00.000Z", meetingTime: "15:30" }],
    });

    expect(display.hasDate).toBe(true);
    expect(display.fullLabel).toContain("15:30");
  });

  it("formats follow-up date separately from the meeting date", () => {
    const display = getLeadFollowUpDisplay({
      meetingDate: "2026-06-01T00:00:00.000Z",
      followUpDate: "2026-07-02T00:00:00.000Z",
    });

    expect(display.hasDate).toBe(true);
    expect(display.fullLabel).toBe("02/07/2026");
  });
});
