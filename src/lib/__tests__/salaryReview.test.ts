import { describe, expect, it } from "vitest";
import { computeSalaryReview } from "../salaryReview";

describe("salary review schedule", () => {
  it("returns nulls without a hiring date", () => {
    const r = computeSalaryReview(null, {});
    expect(r.nextReviewDate).toBeNull();
    expect(r.nextEvaluationDate).toBeNull();
  });

  it("first salary review = hiring + firstReviewMonths", () => {
    const now = new Date("2026-03-01");
    const r = computeSalaryReview("2026-01-01", { firstReviewMonths: 3, regularReviewMonths: 6 }, now);
    // first review is 2026-04-01, still in the future
    expect(r.nextReviewDate?.getMonth()).toBe(3); // April
    expect(r.daysUntilReview).toBeGreaterThan(0);
  });

  it("rolls forward to the next regular review once the first has passed", () => {
    const now = new Date("2026-08-01");
    const r = computeSalaryReview("2026-01-01", { firstReviewMonths: 3, regularReviewMonths: 6 }, now);
    // first 2026-04-01 passed → next is +6 = 2026-10-01
    expect(r.nextReviewDate?.getMonth()).toBe(9); // October
  });

  it("evaluation starts after probation and repeats by frequency", () => {
    const now = new Date("2026-05-01");
    const r = computeSalaryReview("2026-01-01", { probationMonths: 3, evaluationFrequency: "quarterly" }, now);
    // eval start = 2026-04-01 (after 3mo probation); next occurrence >= now → 2026-07-01
    expect(r.nextEvaluationDate?.getMonth()).toBe(6); // July
    expect(r.evaluationFrequency).toBe("quarterly");
  });

  it("does not loop forever on a zero interval", () => {
    const r = computeSalaryReview("2020-01-01", { regularReviewMonths: 0, firstReviewMonths: 3 }, new Date("2026-01-01"));
    expect(r.nextReviewDate).toBeInstanceOf(Date);
  });
});
