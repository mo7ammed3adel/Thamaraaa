/**
 * Leave balance helpers.
 *
 * The system stores each leave/remote/permission request as a LeaveRequest with
 * a free-text `duration` ("1 Day", "Half Day", "2 Hours", …). To show an annual
 * leave balance without a schema change we translate those durations into day
 * counts and subtract the approved *Leave* requests for the year from a quota.
 *
 * Only `type === "Leave"` counts against the annual balance — Remote work and
 * short Permissions don't consume annual leave days.
 */

export const DEFAULT_ANNUAL_LEAVE_DAYS = 21;

const DURATION_DAYS: Record<string, number> = {
  "half day": 0.5,
  "1 day": 1,
  "2 days": 2,
  "3 days": 3,
  "1 week": 5,
  "2 hours": 0.25,
};

/** Best-effort translation of a free-text duration into a number of days. */
export function leaveDaysFromDuration(duration?: string | null): number {
  if (!duration) return 1;
  const key = duration.trim().toLowerCase();
  if (key in DURATION_DAYS) return DURATION_DAYS[key];

  const dayMatch = key.match(/^(\d+(?:\.\d+)?)\s*day/);
  if (dayMatch) return parseFloat(dayMatch[1]);

  const weekMatch = key.match(/^(\d+(?:\.\d+)?)\s*week/);
  if (weekMatch) return parseFloat(weekMatch[1]) * 5;

  const hourMatch = key.match(/^(\d+(?:\.\d+)?)\s*hour/);
  if (hourMatch) return parseFloat(hourMatch[1]) / 8;

  return 1;
}

type LeaveRequestLike = {
  type?: string | null;
  status?: string | null;
  date?: string | Date | null;
  duration?: string | null;
};

/** Sum of approved annual-leave days within the given calendar year. */
export function computeUsedLeaveDays(requests: LeaveRequestLike[], year: number): number {
  return requests.reduce((total, req) => {
    if (req.type !== "Leave" || req.status !== "Approved" || !req.date) return total;
    const reqYear = new Date(req.date).getFullYear();
    if (reqYear !== year) return total;
    return total + leaveDaysFromDuration(req.duration);
  }, 0);
}

export type LeaveBalance = { quota: number; used: number; remaining: number };

/** Annual leave balance: quota minus used (never below zero). */
export function computeLeaveBalance(
  requests: LeaveRequestLike[],
  year: number,
  quota: number = DEFAULT_ANNUAL_LEAVE_DAYS
): LeaveBalance {
  const used = computeUsedLeaveDays(requests, year);
  return { quota, used, remaining: Math.max(0, quota - used) };
}
