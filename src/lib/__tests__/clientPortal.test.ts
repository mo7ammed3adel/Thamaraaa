import { describe, expect, it } from "vitest";
import {
  MAX_FAILED_LOGIN_ATTEMPTS,
  buildClientJourneyView,
  buildClientUsername,
  isLoginLocked,
  minutesUntilUnlock,
  registerFailedLogin,
} from "../clientPortal";

const NOW = new Date("2026-08-30T00:00:00.000Z");

/** A project carrying every internal field the client must never receive. */
function internalProject() {
  return {
    id: "project-1",
    package: "Full",
    projectStatus: "in_progress",
    assignedAt: "2026-06-05T00:00:00.000Z",
    storeUrl: "https://store.example.com",
    seoProgress: 60,
    socialMediaProgress: 40,
    mediaBuyerProgress: 0,
    notes: "internal project notes",
    globalNotes: [{ content: "sales said the client is difficult" }],
    warnings: [{ message: "client is angry" }],
    logs: [{ action: "status_changed" }],
    accountManagerId: "user-am",
    tasks: [
      {
        id: "task-1",
        taskType: "SEO",
        status: "done",
        deadline: "2026-07-01T00:00:00.000Z",
        completedAt: "2026-06-28T00:00:00.000Z",
        files: JSON.stringify([{ label: "تقرير SEO", url: "https://files.example.com/seo.pdf" }]),
        brief: "internal brief for the agent",
        flagReason: "agent was blocked by the client",
        leader: { name: "Ahmed" },
        agent: { name: "Sara" },
      },
      {
        id: "task-2",
        taskType: "Social_Media",
        status: "in_progress",
        deadline: null,
        completedAt: null,
        files: null,
      },
    ],
    deal: {
      totalAmount: 30000,
      firstAmount: 10000,
      netTarget: 27900,
      salesNotes: "margin is thin on this one",
      contractStart: "2026-06-01T00:00:00.000Z",
      contractEnd: "2026-12-01T00:00:00.000Z",
      createdAt: "2026-06-01T00:00:00.000Z",
      installments: [
        { amount: 10000, dueDate: "2026-07-01T00:00:00.000Z", isPaid: true },
        { amount: 10000, dueDate: "2026-08-01T00:00:00.000Z", isPaid: false },
      ],
      lead: { name: "متجر النخبة", phone: "0555123456", salesNotes: "internal" },
      salesAgent: { name: "Mohamed" },
    },
  };
}

describe("buildClientJourneyView", () => {
  it("never leaks internal fields into the serialized view", () => {
    const serialized = JSON.stringify(buildClientJourneyView(internalProject() as any, NOW));

    for (const secret of [
      "internal project notes",
      "sales said the client is difficult",
      "client is angry",
      "internal brief for the agent",
      "agent was blocked by the client",
      "margin is thin on this one",
      "status_changed",
      "Ahmed",
      "Sara",
      "Mohamed",
      "user-am",
      "27900",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("exposes the work the client is entitled to see", () => {
    const view = buildClientJourneyView(internalProject() as any, NOW);

    expect(view.clientName).toBe("متجر النخبة");
    expect(view.project.package).toBe("Full");
    expect(view.project.statusLabel).toBe("جاري التنفيذ");
    expect(view.departments.map((department) => department.department)).toEqual(["seo", "social_media"]);
    expect(view.departments[0].tasks[0].deliverables).toEqual([
      { label: "تقرير SEO", url: "https://files.example.com/seo.pdf" },
    ]);
  });

  it("averages progress only over departments that have work", () => {
    const view = buildClientJourneyView(internalProject() as any, NOW);

    // 60 (SEO) and 40 (Social) count; Media Buyer is 0 and is excluded.
    expect(view.progress.overall).toBe(50);
  });

  it("counts the down payment plus paid installments as paid", () => {
    const { payments } = buildClientJourneyView(internalProject() as any, NOW);

    expect(payments.totalAmount).toBe(30000);
    expect(payments.paidAmount).toBe(20000);
    expect(payments.remainingAmount).toBe(10000);
  });

  it("flags an unpaid installment past its due date as overdue", () => {
    const { payments } = buildClientJourneyView(internalProject() as any, NOW);

    expect(payments.installments[0].statusLabel).toBe("مدفوع");
    expect(payments.installments[1].isOverdue).toBe(true);
    expect(payments.installments[1].statusLabel).toBe("متأخر");
  });

  it("builds a timeline of contract and delivery milestones in order", () => {
    const { timeline } = buildClientJourneyView(internalProject() as any, NOW);

    expect(timeline.map((entry) => entry.title)).toEqual([
      "بداية التعاقد",
      "بدء العمل على المشروع",
      "تم تسليم: تحسين محركات البحث",
      "نهاية العقد",
    ]);
  });

  it("hides task types that have no client-facing presentation", () => {
    const project = internalProject();
    project.tasks.push({
      id: "task-3",
      taskType: "technical",
      status: "pending",
      deadline: null,
      completedAt: null,
      files: null,
    });

    const view = buildClientJourneyView(project as any, NOW);

    expect(view.departments.flatMap((department) => department.tasks)).toHaveLength(2);
  });

  it("survives a malformed deliverables payload", () => {
    const project = internalProject();
    project.tasks[0].files = "not json";

    expect(buildClientJourneyView(project as any, NOW).departments[0].tasks[0].deliverables).toEqual([]);
  });
});

describe("buildClientUsername", () => {
  it("reduces a phone number to digits", () => {
    expect(buildClientUsername("+966 55 512 3456")).toBe("966555123456");
  });

  it("rejects a value too short to be a phone number", () => {
    expect(buildClientUsername("123")).toBeNull();
    expect(buildClientUsername(null)).toBeNull();
  });
});

describe("client portal login lockout", () => {
  it("does not lock before the attempt limit is reached", () => {
    let state = { failedLoginAttempts: 0, lockedUntil: null as Date | null };

    for (let attempt = 1; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      state = registerFailedLogin(state, NOW) as typeof state;
      expect(state.lockedUntil).toBeNull();
      expect(state.failedLoginAttempts).toBe(attempt);
    }
  });

  it("locks the account on the final failed attempt and resets the counter", () => {
    const state = registerFailedLogin(
      { failedLoginAttempts: MAX_FAILED_LOGIN_ATTEMPTS - 1, lockedUntil: null },
      NOW
    );

    expect(state.failedLoginAttempts).toBe(0);
    expect(isLoginLocked(state, NOW)).toBe(true);
    expect(minutesUntilUnlock(state, NOW)).toBe(15);
  });

  it("stops blocking once the lock window has passed", () => {
    const state = { failedLoginAttempts: 0, lockedUntil: new Date(NOW.getTime() - 1000) };

    expect(isLoginLocked(state, NOW)).toBe(false);
    expect(minutesUntilUnlock(state, NOW)).toBe(0);
  });

  it("treats an account that was never locked as unlocked", () => {
    expect(isLoginLocked({ failedLoginAttempts: 2, lockedUntil: null }, NOW)).toBe(false);
  });
});
