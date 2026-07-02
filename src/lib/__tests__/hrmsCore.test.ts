import { describe, expect, it } from "vitest";
import { calculateSlaStatus, candidateMatchScore, salaryChangeMetrics, workflowPreview } from "../hrmsCore";

describe("HRMS core rules", () => {
  it("marks SLA overdue after approval deadline", () => {
    const createdAt = new Date("2026-07-01T08:00:00Z");
    const now = new Date("2026-07-03T09:00:00Z");

    const sla = calculateSlaStatus({ createdAt, responseHours: 24, approvalHours: 48, now });

    expect(sla.status).toBe("overdue");
    expect(sla.remainingMinutes).toBeLessThan(0);
  });

  it("scores reusable candidates from position, skills, salary and interview history", () => {
    const match = candidateMatchScore(
      {
        jobTitle: "Sales Agent",
        department: "Sales",
        skills: ["closing", "crm", "calls"],
        yearsOfExperience: 3,
        expectedSalary: 8000,
        previousInterviewScore: 8.5,
      },
      {
        positionTitle: "Sales Agent",
        department: "Sales",
        requiredSkills: ["crm", "closing"],
        minExperience: 2,
        maxSalary: 9000,
      }
    );

    expect(match.score).toBeGreaterThanOrEqual(80);
    expect(match.reasons).toContain("same position");
  });

  it("computes salary difference amount and percentage", () => {
    expect(salaryChangeMetrics(5000, 5750)).toEqual({
      differenceAmount: 750,
      differencePercentage: 15,
    });
  });

  it("renders workflow steps in approval order", () => {
    expect(
      workflowPreview([
        { stepNumber: 2, name: "HR", approverType: "hr_manager" },
        { stepNumber: 1, name: "Direct Manager", approverType: "direct_manager" },
      ])
    ).toEqual(["1. Direct Manager (direct_manager)", "2. HR (hr_manager)"]);
  });
});
