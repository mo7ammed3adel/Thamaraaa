/**
 * Pure HR dashboard overview builder (no IO) — turns raw employees, leave
 * requests and salary advances into the stat widgets + alerts the HR dashboard
 * shows. Kept pure so it can be unit-tested and reused.
 */

export const HR_DOC_LABELS: Record<string, string> = {
  nationalId: "National ID",
  contract: "Contract",
  socialInsurance: "Social insurance",
  bankAccount: "Bank account",
  photo: "Photo",
  graduationCertificate: "Graduation certificate",
  militaryStatus: "Military status",
};

const ALL_DOC_KEYS = Object.keys(HR_DOC_LABELS);

type EmployeeLike = {
  id: string;
  name: string;
  role?: string | null;
  status?: string | null;
  createdAt: string | Date;
  hrRecord?: {
    documentChecklist?: string | null;
    dateOfBirth?: string | Date | null;
    gender?: string | null;
  } | null;
};

type LeaveLike = {
  userId: string;
  type?: string | null;
  status?: string | null;
  date?: string | Date | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
};

type AdvanceLike = { status?: string | null };

export type HrOverview = {
  totalEmployees: number;
  newThisMonth: number;
  activeEmployees: number;
  remoteToday: number;
  onLeaveToday: number;
  onPermissionToday: number;
  pendingLeave: number;
  pendingRemote: number;
  pendingPermission: number;
  pendingAdvances: number;
  missingDocs: { userId: string; name: string; missing: string[] }[];
  birthdaysThisMonth: { userId: string; name: string; day: number }[];
};

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** True when `today` falls inside the request's window (range, else single date). */
function isActiveOn(req: LeaveLike, today: Date): boolean {
  const start = req.startDate ? new Date(req.startDate) : req.date ? new Date(req.date) : null;
  const end = req.endDate ? new Date(req.endDate) : start;
  if (!start) return false;
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() : s;
  return d >= s && d <= e;
}

function parseChecklist(json?: string | null): Record<string, boolean> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function missingDocsFor(emp: EmployeeLike): string[] {
  const checklist = parseChecklist(emp.hrRecord?.documentChecklist);
  const isMale = (emp.hrRecord?.gender || "").toLowerCase().startsWith("m");
  return ALL_DOC_KEYS.filter((key) => {
    if (key === "militaryStatus" && !isMale) return false; // only required for males
    return !checklist[key];
  }).map((key) => HR_DOC_LABELS[key]);
}

export function buildHrOverview(
  employees: EmployeeLike[],
  leaves: LeaveLike[],
  advances: AdvanceLike[],
  now: Date = new Date()
): HrOverview {
  const approved = (req: LeaveLike) => (req.status || "").toLowerCase() === "approved";
  const pending = (req: LeaveLike) => (req.status || "").toLowerCase() === "pending";
  const isType = (req: LeaveLike, t: string) => (req.type || "").toLowerCase() === t;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const missingDocs = employees
    .filter((e) => (e.status || "Active") === "Active")
    .map((e) => ({ userId: e.id, name: e.name, missing: missingDocsFor(e) }))
    .filter((e) => e.missing.length > 0);

  const birthdaysThisMonth = employees
    .filter((e) => (e.status || "Active") === "Active" && e.hrRecord?.dateOfBirth)
    .map((e) => {
      const dob = new Date(e.hrRecord!.dateOfBirth as string | Date);
      return { userId: e.id, name: e.name, day: dob.getDate(), month: dob.getMonth() };
    })
    .filter((e) => e.month === now.getMonth())
    .map(({ userId, name, day }) => ({ userId, name, day }))
    .sort((a, b) => a.day - b.day);

  return {
    totalEmployees: employees.length,
    newThisMonth: employees.filter((e) => new Date(e.createdAt) >= monthStart).length,
    activeEmployees: employees.filter((e) => (e.status || "Active") === "Active").length,
    remoteToday: leaves.filter((l) => approved(l) && isType(l, "remote") && isActiveOn(l, now)).length,
    onLeaveToday: leaves.filter((l) => approved(l) && isType(l, "leave") && isActiveOn(l, now)).length,
    onPermissionToday: leaves.filter((l) => approved(l) && isType(l, "permission") && isActiveOn(l, now)).length,
    pendingLeave: leaves.filter((l) => pending(l) && isType(l, "leave")).length,
    pendingRemote: leaves.filter((l) => pending(l) && isType(l, "remote")).length,
    pendingPermission: leaves.filter((l) => pending(l) && isType(l, "permission")).length,
    pendingAdvances: advances.filter((a) => (a.status || "").toLowerCase().startsWith("pending")).length,
    missingDocs,
    birthdaysThisMonth,
  };
}
