/**
 * Salary-increase & evaluation scheduling, derived from an employee's hiring
 * date and their department policy (per HR.md). Pure (no IO) so it can be
 * unit-tested and reused by the profile + the employee self-service.
 */

export type SalaryReviewPolicy = {
  firstReviewMonths?: number;
  regularReviewMonths?: number;
  evaluationFrequency?: string; // monthly | quarterly | semiannual | yearly
  evalStartRule?: string; // after_probation | from_hiring
  probationMonths?: number;
  increaseType?: string; // percentage | fixed
  increaseValue?: number;
  minEvalForIncrease?: number;
};

export type SalaryReview = {
  nextReviewDate: Date | null;
  daysUntilReview: number | null;
  nextEvaluationDate: Date | null;
  daysUntilEvaluation: number | null;
  evaluationFrequency: string;
  increaseType: string;
  increaseValue: number;
  minEvalForIncrease: number;
};

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function frequencyMonths(freq?: string): number {
  switch ((freq || "").toLowerCase()) {
    case "monthly": return 1;
    case "quarterly": return 3;
    case "semiannual": return 6;
    case "yearly": return 12;
    default: return 3;
  }
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/** Advances `start` by `step` months until it is on or after `now` (guarded against step<=0). */
function nextOccurrence(start: Date, step: number, now: Date): Date {
  if (step <= 0) return start;
  let d = new Date(start);
  let guard = 0;
  while (d < now && guard < 1200) {
    d = addMonths(d, step);
    guard += 1;
  }
  return d;
}

export function computeSalaryReview(
  hiringDate: string | Date | null | undefined,
  policy: SalaryReviewPolicy = {},
  now: Date = new Date()
): SalaryReview {
  const increaseType = policy.increaseType || "percentage";
  const increaseValue = Number(policy.increaseValue) || 0;
  const minEvalForIncrease = Number(policy.minEvalForIncrease) || 0;
  const evaluationFrequency = policy.evaluationFrequency || "quarterly";

  if (!hiringDate) {
    return { nextReviewDate: null, daysUntilReview: null, nextEvaluationDate: null, daysUntilEvaluation: null, evaluationFrequency, increaseType, increaseValue, minEvalForIncrease };
  }
  const hire = new Date(hiringDate);
  if (Number.isNaN(hire.getTime())) {
    return { nextReviewDate: null, daysUntilReview: null, nextEvaluationDate: null, daysUntilEvaluation: null, evaluationFrequency, increaseType, increaseValue, minEvalForIncrease };
  }

  // Salary review: first review after `firstReviewMonths`, then every `regularReviewMonths`.
  const firstReview = addMonths(hire, Number(policy.firstReviewMonths) || 3);
  const nextReviewDate = firstReview >= now ? firstReview : nextOccurrence(firstReview, Number(policy.regularReviewMonths) || 6, now);

  // Evaluation: starts after probation (or from hiring), then every frequency interval.
  const evalStart = (policy.evalStartRule || "after_probation") === "from_hiring"
    ? hire
    : addMonths(hire, Number(policy.probationMonths) || 3);
  const nextEvaluationDate = evalStart >= now ? evalStart : nextOccurrence(evalStart, frequencyMonths(evaluationFrequency), now);

  return {
    nextReviewDate,
    daysUntilReview: Math.max(0, daysBetween(now, nextReviewDate)),
    nextEvaluationDate,
    daysUntilEvaluation: Math.max(0, daysBetween(now, nextEvaluationDate)),
    evaluationFrequency,
    increaseType,
    increaseValue,
    minEvalForIncrease,
  };
}
