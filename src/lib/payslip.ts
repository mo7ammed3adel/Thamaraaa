/**
 * Payslip computation.
 *
 * A monthly payslip is derived entirely from data the system already stores —
 * the employee's base salary (HrRecord), any approved attendance deductions for
 * the month (Attendance.deductionDraft where deductionApproved), and any
 * commission/bonus recorded for that month (Commission). No payslip table is
 * needed; each slip is computed on demand.
 */

export type PayslipInput = {
  baseSalary: number;
  bonuses?: number;
  deductions?: number;
};

export type Payslip = {
  baseSalary: number;
  bonuses: number;
  deductions: number;
  net: number;
};

/** net = base + bonuses − deductions, never below zero. */
export function computePayslip(input: PayslipInput): Payslip {
  const baseSalary = round2(Math.max(0, input.baseSalary || 0));
  const bonuses = round2(Math.max(0, input.bonuses || 0));
  const deductions = round2(Math.max(0, input.deductions || 0));
  const net = round2(Math.max(0, baseSalary + bonuses - deductions));
  return { baseSalary, bonuses, deductions, net };
}

/** Inclusive start / exclusive end Date range for a "YYYY-MM" month string. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { start, end };
}

/** Current month as "YYYY-MM". */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
