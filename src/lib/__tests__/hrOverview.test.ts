import { describe, expect, it } from "vitest";
import { buildHrOverview } from "../hrOverview";

const NOW = new Date("2026-06-15T10:00:00Z");

describe("HR overview", () => {
  const employees = [
    {
      id: "e1",
      name: "Ahmed",
      status: "Active",
      createdAt: "2026-06-02",
      hrRecord: { documentChecklist: JSON.stringify({ nationalId: true }), gender: "Male", dateOfBirth: "1995-06-20" },
    },
    {
      id: "e2",
      name: "Sara",
      status: "Active",
      createdAt: "2025-01-10",
      hrRecord: { documentChecklist: JSON.stringify({ nationalId: true, contract: true, socialInsurance: true, bankAccount: true, photo: true, graduationCertificate: true }), gender: "Female", dateOfBirth: "1990-03-01" },
    },
    { id: "e3", name: "Ali", status: "Inactive", createdAt: "2024-01-01", hrRecord: null },
  ];

  const leaves = [
    { userId: "e1", type: "Remote", status: "Approved", date: "2026-06-15" },
    { userId: "e2", type: "Leave", status: "Approved", startDate: "2026-06-14", endDate: "2026-06-16" },
    { userId: "e1", type: "Permission", status: "Pending", date: "2026-06-20" },
    { userId: "e2", type: "Leave", status: "Pending", date: "2026-06-25" },
  ];

  const advances = [{ status: "pending_dept_head" }, { status: "paid" }];

  it("counts employees, active and new-this-month", () => {
    const o = buildHrOverview(employees, leaves, advances, NOW);
    expect(o.totalEmployees).toBe(3);
    expect(o.activeEmployees).toBe(2);
    expect(o.newThisMonth).toBe(1); // only Ahmed (June 2026)
  });

  it("counts who is remote / on-leave / on-permission today", () => {
    const o = buildHrOverview(employees, leaves, advances, NOW);
    expect(o.remoteToday).toBe(1);
    expect(o.onLeaveToday).toBe(1); // Sara's range covers the 15th
    expect(o.onPermissionToday).toBe(0);
  });

  it("counts pending requests and advances", () => {
    const o = buildHrOverview(employees, leaves, advances, NOW);
    expect(o.pendingPermission).toBe(1);
    expect(o.pendingLeave).toBe(1);
    expect(o.pendingAdvances).toBe(1);
  });

  it("flags missing documents (military only required for males)", () => {
    const o = buildHrOverview(employees, leaves, advances, NOW);
    const ahmed = o.missingDocs.find((m) => m.userId === "e1");
    expect(ahmed?.missing).toContain("Military status"); // male → required
    expect(o.missingDocs.find((m) => m.userId === "e2")).toBeUndefined(); // Sara complete (no military for female)
  });

  it("lists birthdays in the current month", () => {
    const o = buildHrOverview(employees, leaves, advances, NOW);
    expect(o.birthdaysThisMonth.map((b) => b.name)).toEqual(["Ahmed"]); // June birthday
  });
});
