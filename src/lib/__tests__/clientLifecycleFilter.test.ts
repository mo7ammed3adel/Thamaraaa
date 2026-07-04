import { describe, expect, it } from "vitest";
import { matchesClientLifecycleFilters } from "../clientLifecycleFilter";

const lifecycleLog = (to: string, createdAt: string) => ({
  action: "lifecycle_changed",
  details: JSON.stringify({ from: "Active", to, changedBy: "Test User" }),
  createdAt,
});

describe("client lifecycle filters", () => {
  it("matches the current lifecycle state by the date it entered that state", () => {
    const project = {
      lifecycleState: "Hold",
      createdAt: "2026-06-01T10:00:00.000Z",
      logs: [lifecycleLog("Hold", "2026-07-03T12:00:00.000Z")],
    };

    expect(
      matchesClientLifecycleFilters(project, {
        lifecycleState: "Hold",
        from: "2026-07-01",
        to: "2026-07-05",
      })
    ).toBe(true);
  });

  it("does not use the project creation date when a lifecycle change log exists", () => {
    const project = {
      lifecycleState: "Hold",
      createdAt: "2026-07-02T10:00:00.000Z",
      logs: [lifecycleLog("Hold", "2026-06-20T12:00:00.000Z")],
    };

    expect(
      matchesClientLifecycleFilters(project, {
        lifecycleState: "Hold",
        from: "2026-07-01",
        to: "2026-07-05",
      })
    ).toBe(false);
  });

  it("falls back to the project creation date when the current state has no log", () => {
    const project = {
      lifecycleState: "Active",
      createdAt: "2026-07-02T10:00:00.000Z",
      logs: [],
    };

    expect(
      matchesClientLifecycleFilters(project, {
        lifecycleState: "Active",
        from: "2026-07-01",
        to: "2026-07-05",
      })
    ).toBe(true);
  });

  it("rejects historical matches when the current lifecycle state is different", () => {
    const project = {
      lifecycleState: "Active",
      createdAt: "2026-06-01T10:00:00.000Z",
      logs: [
        lifecycleLog("Active", "2026-07-04T12:00:00.000Z"),
        lifecycleLog("Hold", "2026-07-02T12:00:00.000Z"),
      ],
    };

    expect(
      matchesClientLifecycleFilters(project, {
        lifecycleState: "Hold",
        from: "2026-07-01",
        to: "2026-07-05",
      })
    ).toBe(false);
  });
});
