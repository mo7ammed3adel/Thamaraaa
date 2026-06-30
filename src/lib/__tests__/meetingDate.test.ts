import { describe, expect, it } from "vitest";
import { isPastMeetingDate } from "../meetingDate";

function utcDateString(offsetDays: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

describe("isPastMeetingDate", () => {
  it("rejects yesterday and earlier", () => {
    expect(isPastMeetingDate(utcDateString(-1))).toBe(true);
    expect(isPastMeetingDate(utcDateString(-30))).toBe(true);
  });

  it("allows today", () => {
    expect(isPastMeetingDate(utcDateString(0))).toBe(false);
  });

  it("allows future dates", () => {
    expect(isPastMeetingDate(utcDateString(1))).toBe(false);
    expect(isPastMeetingDate(utcDateString(14))).toBe(false);
  });

  it("treats empty/invalid input as not-past so required handling still applies", () => {
    expect(isPastMeetingDate("")).toBe(false);
    expect(isPastMeetingDate(null)).toBe(false);
    expect(isPastMeetingDate(undefined)).toBe(false);
    expect(isPastMeetingDate("not-a-date")).toBe(false);
  });
});
