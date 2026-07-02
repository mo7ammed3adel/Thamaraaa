export type SlaStatus = "on_track" | "due_soon" | "overdue";

export type SlaInput = {
  createdAt: Date;
  responseHours: number;
  approvalHours: number;
  now?: Date;
};

export type CandidateForMatch = {
  jobTitle?: string | null;
  department?: string | null;
  skills?: string[];
  yearsOfExperience?: number | null;
  expectedSalary?: number | null;
  city?: string | null;
  previousInterviewScore?: number | null;
};

export type HiringNeedForMatch = {
  positionTitle?: string | null;
  department?: string | null;
  requiredSkills?: string[];
  minExperience?: number | null;
  maxSalary?: number | null;
  city?: string | null;
};

export type WorkflowStepPreview = {
  stepNumber: number;
  name: string;
  approverType: string;
  mode?: string | null;
};

export function calculateSlaStatus(input: SlaInput): {
  status: SlaStatus;
  responseDueAt: Date;
  approvalDueAt: Date;
  remainingMinutes: number;
} {
  const now = input.now ?? new Date();
  const responseDueAt = addHours(input.createdAt, input.responseHours);
  const approvalDueAt = addHours(input.createdAt, input.approvalHours);
  const remainingMinutes = Math.floor((approvalDueAt.getTime() - now.getTime()) / 60000);

  if (remainingMinutes < 0) {
    return { status: "overdue", responseDueAt, approvalDueAt, remainingMinutes };
  }

  const dueSoonWindowMinutes = Math.max(60, Math.floor(input.approvalHours * 60 * 0.2));
  if (remainingMinutes <= dueSoonWindowMinutes) {
    return { status: "due_soon", responseDueAt, approvalDueAt, remainingMinutes };
  }

  return { status: "on_track", responseDueAt, approvalDueAt, remainingMinutes };
}

export function candidateMatchScore(candidate: CandidateForMatch, need: HiringNeedForMatch) {
  let score = 0;
  const reasons: string[] = [];

  if (sameText(candidate.jobTitle, need.positionTitle)) {
    score += 25;
    reasons.push("same position");
  }

  if (sameText(candidate.department, need.department)) {
    score += 20;
    reasons.push("same department");
  }

  const matchedSkills = matchingSkills(candidate.skills || [], need.requiredSkills || []);
  if (matchedSkills.length > 0) {
    score += Math.min(25, matchedSkills.length * 5);
    reasons.push(`${matchedSkills.length} matching skill(s)`);
  }

  if ((candidate.yearsOfExperience || 0) >= (need.minExperience || 0)) {
    score += 10;
    reasons.push("experience fits");
  }

  if (!need.maxSalary || !candidate.expectedSalary || candidate.expectedSalary <= need.maxSalary) {
    score += 10;
    reasons.push("salary fits");
  }

  if (need.city && sameText(candidate.city, need.city)) {
    score += 5;
    reasons.push("same city");
  }

  if ((candidate.previousInterviewScore || 0) >= 8) {
    score += 5;
    reasons.push("strong previous interview");
  }

  return { score: Math.min(100, score), reasons };
}

export function salaryChangeMetrics(previousSalary: number, proposedSalary: number) {
  const differenceAmount = roundMoney(proposedSalary - previousSalary);
  const differencePercentage = previousSalary > 0 ? roundMoney((differenceAmount / previousSalary) * 100) : 0;
  return { differenceAmount, differencePercentage };
}

export function workflowPreview(steps: WorkflowStepPreview[]) {
  return steps
    .slice()
    .sort((left, right) => left.stepNumber - right.stepNumber)
    .map((step) => `${step.stepNumber}. ${step.name} (${step.approverType}${step.mode ? `, ${step.mode}` : ""})`);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + Math.max(0, hours) * 3600000);
}

function sameText(left?: string | null, right?: string | null) {
  return normalizeText(left) !== "" && normalizeText(left) === normalizeText(right);
}

function normalizeText(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function matchingSkills(candidateSkills: string[], requiredSkills: string[]) {
  const required = new Set(requiredSkills.map(normalizeText).filter(Boolean));
  return candidateSkills.map(normalizeText).filter((skill) => skill && required.has(skill));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
