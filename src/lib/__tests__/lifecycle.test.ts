import { describe, expect, it } from "vitest";
import { isWorkBlockedByLifecycle, lifecycleBlockedMessage } from "../lifecycle";

describe("isWorkBlockedByLifecycle", () => {
  it("blocks work for clients on Hold or Lost", () => {
    expect(isWorkBlockedByLifecycle("Hold")).toBe(true);
    expect(isWorkBlockedByLifecycle("Lost")).toBe(true);
  });

  it("allows work for Active and Renewer clients", () => {
    expect(isWorkBlockedByLifecycle("Active")).toBe(false);
    expect(isWorkBlockedByLifecycle("Renewer")).toBe(false);
  });

  it("treats a missing state as not blocked so legacy rows keep working", () => {
    expect(isWorkBlockedByLifecycle(null)).toBe(false);
    expect(isWorkBlockedByLifecycle(undefined)).toBe(false);
    expect(isWorkBlockedByLifecycle("")).toBe(false);
  });
});

describe("lifecycleBlockedMessage", () => {
  it("names the blocking state with the label shown on the client badge", () => {
    expect(lifecycleBlockedMessage("Hold")).toContain("هولد");
    expect(lifecycleBlockedMessage("Lost")).toContain("فقد");
  });
});
