/**
 * Leave balances per HR.md:
 *  - Remote: 4 days every month (monthly allowance, resets each month)
 *  - Permission: 6 hours every month (monthly allowance, resets each month)
 *  - Annual leave: accrues 1.75 days/month, but ONLY after completing 3 months
 *    from the hiring date; unused annual leave carries forward within the year.
 * Pure (no IO) so it can be unit-tested and reused by the profile + self-service.
 */

export const REMOTE_DAYS_PER_MONTH = 4;
export const PERMISSION_HOURS_PER_MONTH = 6;
export const ANNUAL_LEAVE_PER_MONTH = 1.75;
export const LEAVE_ELIGIBILITY_MONTHS = 3;

/** Whole months completed between hiring date and `now`. */
export function monthsCompleted(hiringDate: string | Date | null | undefined, now: Date = new Date()): number {
  if (!hiringDate) return 0;
  const start = new Date(hiringDate);
  if (Number.isNaN(start.getTime())) return 0;
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1; // not a full month yet
  return Math.max(0, months);
}

/** Accrued annual leave: 1.75/month for each month worked beyond the 3-month eligibility gate. */
export function accruedAnnualLeave(hiringDate: string | Date | null | undefined, now: Date = new Date()): number {
  const months = monthsCompleted(hiringDate, now);
  if (months < LEAVE_ELIGIBILITY_MONTHS) return 0;
  return round2(ANNUAL_LEAVE_PER_MONTH * (months - LEAVE_ELIGIBILITY_MONTHS));
}

type LeaveLike = {
  type?: string | null;
  status?: string | null;
  date?: string | Date | null;
  startDate?: string | Date | null;
  days?: number | null;
  duration?: string | null;
};

function leaveYear(req: LeaveLike): number | null {
  const d = req.startDate || req.date;
  return d ? new Date(d).getFullYear() : null;
}

function dayCount(req: LeaveLike): number {
  if (typeof req.days === "number" && req.days > 0) return req.days;
  return 1;
}

export type LeaveSummary = {
  annual: { accrued: number; used: number; remaining: number };
  remote: { allowance: number; used: number; remaining: number };
  permission: { allowance: number; used: number; remaining: number };
  eligibleForAnnual: boolean;
  monthsWorked: number;
};

/**
 * Builds the full leave summary for one employee from their requests.
 * Remote/permission "used" are counted for the current month only (monthly reset);
 * annual "used" is counted for the current calendar year (carries forward).
 */
export function buildLeaveSummary(
  hiringDate: string | Date | null | undefined,
  requests: LeaveLike[],
  now: Date = new Date()
): LeaveSummary {
  const approved = (r: LeaveLike) => (r.status || "").toLowerCase() === "approved";
  const isType = (r: LeaveLike, t: string) => (r.type || "").toLowerCase() === t;
  const thisMonth = (r: LeaveLike) => {
    const d = r.startDate || r.date;
    if (!d) return false;
    const dt = new Date(d);
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
  };

  const annualUsed = round2(
    requests.filter((r) => approved(r) && isType(r, "leave") && leaveYear(r) === now.getFullYear())
      .reduce((sum, r) => sum + dayCount(r), 0)
  );
  const remoteUsed = requests.filter((r) => approved(r) && isType(r, "remote") && thisMonth(r)).reduce((s, r) => s + dayCount(r), 0);
  const permissionUsed = requests
    .filter((r) => approved(r) && isType(r, "permission") && thisMonth(r))
    .reduce((s, r) => s + permissionHours(r), 0);

  const accrued = accruedAnnualLeave(hiringDate, now);
  const months = monthsCompleted(hiringDate, now);

  return {
    annual: { accrued, used: annualUsed, remaining: round2(Math.max(0, accrued - annualUsed)) },
    remote: { allowance: REMOTE_DAYS_PER_MONTH, used: remoteUsed, remaining: Math.max(0, REMOTE_DAYS_PER_MONTH - remoteUsed) },
    permission: { allowance: PERMISSION_HOURS_PER_MONTH, used: permissionUsed, remaining: Math.max(0, PERMISSION_HOURS_PER_MONTH - permissionUsed) },
    eligibleForAnnual: months >= LEAVE_ELIGIBILITY_MONTHS,
    monthsWorked: months,
  };
}

function permissionHours(req: LeaveLike): number {
  if (typeof req.days === "number" && req.days > 0) return req.days;
  const m = (req.duration || "").match(/(\d+(?:\.\d+)?)\s*hour/i);
  return m ? parseFloat(m[1]) : 1;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
