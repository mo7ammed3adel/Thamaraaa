import { DateRangeValue, isDateInRange } from "@/lib/dateRange";
import { LIFECYCLE_STATE } from "@/lib/constants";

type LifecycleLog = {
  action?: string | null;
  details?: string | null;
  createdAt?: string | Date | null;
};

type LifecycleProject = {
  lifecycleState?: string | null;
  createdAt?: string | Date | null;
  logs?: LifecycleLog[] | null;
};

type ClientLifecycleFilters = DateRangeValue & {
  lifecycleState: string;
};

const ALL_LIFECYCLE_STATES = "all";
const LIFECYCLE_CHANGED_ACTION = "lifecycle_changed";

function parseLifecycleTargetState(details?: string | null): string | null {
  if (!details) return null;

  try {
    const parsed = JSON.parse(details) as { to?: unknown };
    return typeof parsed.to === "string" ? parsed.to : null;
  } catch {
    return null;
  }
}

function findLatestLifecycleEntryDate(project: LifecycleProject, lifecycleState: string) {
  const matchingLog = (project.logs || []).find((log) => {
    return log.action === LIFECYCLE_CHANGED_ACTION && parseLifecycleTargetState(log.details) === lifecycleState;
  });

  return matchingLog?.createdAt || project.createdAt;
}

function getClientLifecycleFilterDate(project: LifecycleProject, lifecycleState: string) {
  if (lifecycleState === ALL_LIFECYCLE_STATES) {
    return project.createdAt;
  }

  return findLatestLifecycleEntryDate(project, lifecycleState);
}

export function matchesClientLifecycleFilters(project: LifecycleProject, filters: ClientLifecycleFilters): boolean {
  const selectedState = filters.lifecycleState || ALL_LIFECYCLE_STATES;

  if (selectedState !== ALL_LIFECYCLE_STATES && (project.lifecycleState || "Active") !== selectedState) {
    return false;
  }

  const lifecycleDate = getClientLifecycleFilterDate(project, selectedState);
  return isDateInRange(lifecycleDate, { from: filters.from, to: filters.to });
}

/**
 * Counts projects per lifecycle state so a dashboard can show one tile per
 * state. Every state is present in the result (0 when nothing matches), and a
 * project with no stored state counts as Active — the schema default.
 */
export function countProjectsByLifecycleState(
  projects: LifecycleProject[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const state of Object.values(LIFECYCLE_STATE)) counts[state] = 0;

  for (const project of projects) {
    const state = project.lifecycleState || LIFECYCLE_STATE.ACTIVE;
    counts[state] = (counts[state] || 0) + 1;
  }

  return counts;
}
