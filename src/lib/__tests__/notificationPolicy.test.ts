import { describe, expect, it } from "vitest";
import { canReceiveNotification } from "../notificationPolicy";

describe("notification policy", () => {
  it("allows notifications for signed-in operational statuses", () => {
    expect(canReceiveNotification("Active")).toBe(true);
    expect(canReceiveNotification("Busy")).toBe(true);
    expect(canReceiveNotification("In_Call")).toBe(true);
  });

  it("blocks notifications for inactive or missing users", () => {
    expect(canReceiveNotification("Inactive")).toBe(false);
    expect(canReceiveNotification(null)).toBe(false);
    expect(canReceiveNotification(undefined)).toBe(false);
  });
});
