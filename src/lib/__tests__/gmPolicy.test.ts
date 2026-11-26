import { describe, expect, it } from "vitest";
import { guardedAction } from "@/lib/gmPolicy";

describe("guardedAction (general manager edit/delete gate)", () => {
  it("treats PATCH/PUT as edits and DELETE as deletes", () => {
    expect(guardedAction("PATCH", "/api/leads/123")).toBe("edit");
    expect(guardedAction("PUT", "/api/custom-columns/values")).toBe("edit");
    expect(guardedAction("DELETE", "/api/users/123")).toBe("delete");
    expect(guardedAction("delete", "/api/companies/9/")).toBe("delete");
  });

  it("treats every POST that isn't a known create as an edit", () => {
    expect(guardedAction("POST", "/api/hr/promotion-engine")).toBe("edit");
    expect(guardedAction("POST", "/api/hr/evaluations")).toBe("edit");
    expect(guardedAction("POST", "/api/hr/viral")).toBe("edit");
    expect(guardedAction("POST", "/api/finance/commissions")).toBe("edit");
    expect(guardedAction("POST", "/api/some/new/route")).toBe("edit");
  });

  it("lets you set your own presence, not someone else's", () => {
    expect(guardedAction("PATCH", "/api/users/me-1/status", "me-1")).toBeNull();
    expect(guardedAction("PATCH", "/api/users/other/status", "me-1")).toBe("edit");
  });

  it("lets reads and creates through", () => {
    expect(guardedAction("GET", "/api/users")).toBeNull();
    expect(guardedAction("POST", "/api/leads")).toBeNull();
    expect(guardedAction("POST", "/api/deals")).toBeNull();
    expect(guardedAction("POST", "/api/users")).toBeNull();
  });

  it("knows POST routes that edit or delete", () => {
    expect(guardedAction("POST", "/api/leads/bulk/delete")).toBe("delete");
    expect(guardedAction("POST", "/api/admin/wipe-test-data")).toBe("delete");
    expect(guardedAction("POST", "/api/projects/abc/reassign-am")).toBe("edit");
    expect(guardedAction("POST", "/api/projects/distribute")).toBe("edit");
    expect(guardedAction("POST", "/api/tasks/abc/reassign")).toBe("edit");
    expect(guardedAction("POST", "/api/settings")).toBe("edit");
    expect(guardedAction("POST", "/api/leads/123/no-show")).toBe("edit");
    expect(guardedAction("POST", "/api/client-accounts/x/reset-password")).toBe("edit");
  });

  it("never blocks the GM's own chat, photo, password or notifications", () => {
    for (const [m, p] of [
      ["DELETE", "/api/chat/messages/1"],
      ["PATCH", "/api/chat/messages/1"],
      ["POST", "/api/me/avatar"],
      ["DELETE", "/api/me/avatar"],
      ["PATCH", "/api/notifications/1"],
      ["POST", "/api/account/change-password"],
      ["DELETE", "/api/admin/impersonate"],
      ["POST", "/api/warnings/1/acknowledge"],
    ] as const) {
      expect(guardedAction(m, p)).toBeNull();
    }
  });

  it("doesn't let a look-alike path dodge the gate", () => {
    expect(guardedAction("DELETE", "/api/chatty/1")).toBe("delete");
    expect(guardedAction("PATCH", "/api/medical")).toBe("edit");
    expect(guardedAction("POST", "/api/projects/abc/reassign-am/")).toBe("edit");
  });
});
