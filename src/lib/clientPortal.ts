/**
 * Client Portal projection.
 *
 * This module is the security boundary between the internal project record and
 * what the CUSTOMER is allowed to see. It is deliberately an allow-list: the
 * view is assembled field by field from the raw project, so anything added to
 * the schema later stays invisible until someone explicitly exposes it here.
 *
 * Never surfaced to a client, by design:
 *   - Warning / WarningReceipt   (internal escalation channel)
 *   - Note                        (every category, including sales/telesales)
 *   - Lead.salesNotes, CallLog, Meeting notes
 *   - Deal.netTarget, Commission  (internal margins)
 *   - Task.brief, Task.flagReason (internal instructions and blockers)
 *   - ProjectLog                  (internal audit trail)
 *   - Any employee name, id or role
 *
 * Pure (no Prisma, no IO) so the boundary can be unit-tested directly.
 */

export type ClientDeliverable = {
  label: string;
  url: string;
};

export type ClientTaskView = {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  deadline: string | null;
  completedAt: string | null;
  deliverables: ClientDeliverable[];
};

export type ClientDepartmentView = {
  department: string;
  label: string;
  tasks: ClientTaskView[];
  completedCount: number;
  totalCount: number;
};

export type ClientTimelineEntry = {
  date: string;
  title: string;
};

export type ClientInstallmentView = {
  amount: number;
  dueDate: string;
  isPaid: boolean;
  /** "مدفوع" | "مستحق" | "متأخر" — what the client sees next to the amount. */
  statusLabel: string;
  isOverdue: boolean;
};

export type ClientPaymentsView = {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  downPayment: number | null;
  installments: ClientInstallmentView[];
};

export type ClientJourneyView = {
  clientName: string;
  project: {
    id: string;
    package: string;
    statusLabel: string;
    contractStart: string | null;
    contractEnd: string | null;
    storeUrl: string | null;
  };
  progress: { seo: number; socialMedia: number; mediaBuyer: number; overall: number };
  departments: ClientDepartmentView[];
  payments: ClientPaymentsView;
  timeline: ClientTimelineEntry[];
};

/** Task type → the department heading and work name a client understands. */
const TASK_TYPE_PRESENTATION: Record<string, { department: string; label: string; work: string }> = {
  SEO: { department: "seo", label: "تحسين محركات البحث (SEO)", work: "تحسين محركات البحث" },
  seo: { department: "seo", label: "تحسين محركات البحث (SEO)", work: "تحسين محركات البحث" },
  content_seo: { department: "content", label: "المحتوى", work: "كتابة محتوى" },
  Social_Media: { department: "social_media", label: "السوشيال ميديا", work: "إدارة السوشيال ميديا" },
  social_media: { department: "social_media", label: "السوشيال ميديا", work: "إدارة السوشيال ميديا" },
  Media_Buyer: { department: "media_buyer", label: "الإعلانات المموّلة", work: "إدارة الحملات الإعلانية" },
  media_buyer: { department: "media_buyer", label: "الإعلانات المموّلة", work: "إدارة الحملات الإعلانية" },
  media_buying: { department: "media_buyer", label: "الإعلانات المموّلة", work: "إدارة الحملات الإعلانية" },
  graphic_design: { department: "design", label: "التصميم", work: "تصميم جرافيك" },
  motion_graphic: { department: "design", label: "التصميم", work: "موشن جرافيك" },
  ui_design: { department: "design", label: "التصميم", work: "تصميم واجهات" },
};

/** Order departments the way the client hears about them, not by insertion order. */
const DEPARTMENT_ORDER = ["seo", "content", "social_media", "media_buyer", "design"];

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "في الانتظار",
  in_progress: "جاري التنفيذ",
  review: "تحت المراجعة",
  done: "تم التسليم",
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  new: "جاري التجهيز",
  setup: "جاري التجهيز",
  assigned: "جاري التجهيز",
  in_progress: "جاري التنفيذ",
  on_hold: "متوقف مؤقتًا",
  delayed: "متأخر عن الموعد",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export function getClientTaskStatusLabel(status: string): string {
  return TASK_STATUS_LABELS[status] || status;
}

export function getClientProjectStatusLabel(projectStatus: string): string {
  return PROJECT_STATUS_LABELS[projectStatus] || projectStatus;
}

type RawTask = {
  id: string;
  taskType: string;
  status: string;
  deadline?: Date | string | null;
  completedAt?: Date | string | null;
  files?: string | null;
};

type RawInstallment = { amount: number; dueDate: Date | string; isPaid: boolean };

type RawProject = {
  id: string;
  package: string;
  projectStatus: string;
  assignedAt?: Date | string | null;
  storeUrl?: string | null;
  seoProgress?: number | null;
  socialMediaProgress?: number | null;
  mediaBuyerProgress?: number | null;
  tasks?: RawTask[] | null;
  deal?: {
    totalAmount?: number | null;
    firstAmount?: number | null;
    contractStart?: Date | string | null;
    contractEnd?: Date | string | null;
    createdAt?: Date | string | null;
    installments?: RawInstallment[] | null;
    lead?: { name?: string | null } | null;
  } | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Deliverable links are stored as a JSON string; a malformed value yields none. */
function parseDeliverables(files: string | null | undefined): ClientDeliverable[] {
  if (!files) return [];
  try {
    const parsed = JSON.parse(files);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry === "object" && typeof entry.url === "string")
      .map((entry) => ({
        label: typeof entry.label === "string" && entry.label ? entry.label : "ملف",
        url: entry.url as string,
      }));
  } catch {
    return [];
  }
}

function buildDepartments(tasks: RawTask[]): ClientDepartmentView[] {
  const byDepartment = new Map<string, ClientDepartmentView>();

  for (const task of tasks) {
    const presentation = TASK_TYPE_PRESENTATION[task.taskType];
    // A task type with no client-facing presentation stays internal.
    if (!presentation) continue;

    if (!byDepartment.has(presentation.department)) {
      byDepartment.set(presentation.department, {
        department: presentation.department,
        label: presentation.label,
        tasks: [],
        completedCount: 0,
        totalCount: 0,
      });
    }

    const group = byDepartment.get(presentation.department)!;
    group.tasks.push({
      id: task.id,
      title: presentation.work,
      status: task.status,
      statusLabel: getClientTaskStatusLabel(task.status),
      deadline: toIso(task.deadline),
      completedAt: toIso(task.completedAt),
      deliverables: parseDeliverables(task.files),
    });
    group.totalCount += 1;
    if (task.status === "done") group.completedCount += 1;
  }

  return Array.from(byDepartment.values()).sort(
    (a, b) => DEPARTMENT_ORDER.indexOf(a.department) - DEPARTMENT_ORDER.indexOf(b.department)
  );
}

/**
 * What the client owes and has already paid. The down payment (Deal.firstAmount)
 * is collected at signing and has no Installment row, so it is counted as paid
 * on its own; the Installment rows are the scheduled remainder.
 * @param now Reference time for deciding which unpaid installments are overdue
 */
function buildPayments(deal: RawProject["deal"], now: Date): ClientPaymentsView {
  const totalAmount = deal?.totalAmount ?? 0;
  const downPayment = deal?.firstAmount ?? null;
  const installments: ClientInstallmentView[] = (deal?.installments || []).map((installment) => {
    const dueDate = toIso(installment.dueDate) || "";
    const isOverdue = !installment.isPaid && dueDate !== "" && new Date(dueDate) < now;
    return {
      amount: installment.amount,
      dueDate,
      isPaid: installment.isPaid,
      isOverdue,
      statusLabel: installment.isPaid ? "مدفوع" : isOverdue ? "متأخر" : "مستحق",
    };
  });

  const paidInstallments = installments
    .filter((installment) => installment.isPaid)
    .reduce((sum, installment) => sum + installment.amount, 0);
  const paidAmount = (downPayment ?? 0) + paidInstallments;

  return {
    totalAmount,
    paidAmount,
    remainingAmount: Math.max(totalAmount - paidAmount, 0),
    downPayment,
    installments,
  };
}

/**
 * Timeline of milestones the client took part in or is entitled to see:
 * the contract, the day work started, and every delivered piece of work.
 * Internal events (calls, meetings, warnings, status edits) are excluded.
 */
function buildTimeline(project: RawProject, departments: ClientDepartmentView[]): ClientTimelineEntry[] {
  const entries: ClientTimelineEntry[] = [];

  const contractStart = toIso(project.deal?.contractStart) || toIso(project.deal?.createdAt);
  if (contractStart) entries.push({ date: contractStart, title: "بداية التعاقد" });

  const startedAt = toIso(project.assignedAt);
  if (startedAt) entries.push({ date: startedAt, title: "بدء العمل على المشروع" });

  for (const department of departments) {
    for (const task of department.tasks) {
      if (task.completedAt) {
        entries.push({ date: task.completedAt, title: `تم تسليم: ${task.title}` });
      }
    }
  }

  const contractEnd = toIso(project.deal?.contractEnd);
  if (contractEnd) entries.push({ date: contractEnd, title: "نهاية العقد" });

  return entries.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Builds the complete client-facing view of one project.
 * @param project Raw project with deal, lead name, tasks and installments loaded
 * @param now Reference time used to flag overdue installments
 */
export function buildClientJourneyView(project: RawProject, now: Date = new Date()): ClientJourneyView {
  const departments = buildDepartments(project.tasks || []);
  const seo = project.seoProgress ?? 0;
  const socialMedia = project.socialMediaProgress ?? 0;
  const mediaBuyer = project.mediaBuyerProgress ?? 0;

  const activeProgress = [seo, socialMedia, mediaBuyer].filter((value) => value > 0);
  const overall =
    activeProgress.length > 0
      ? activeProgress.reduce((sum, value) => sum + value, 0) / activeProgress.length
      : 0;

  return {
    clientName: project.deal?.lead?.name || "",
    project: {
      id: project.id,
      package: project.package,
      statusLabel: getClientProjectStatusLabel(project.projectStatus),
      contractStart: toIso(project.deal?.contractStart),
      contractEnd: toIso(project.deal?.contractEnd),
      storeUrl: project.storeUrl ?? null,
    },
    progress: { seo, socialMedia, mediaBuyer, overall },
    departments,
    payments: buildPayments(project.deal, now),
    timeline: buildTimeline(project, departments),
  };
}

/**
 * Username for a client portal account: the customer's phone number reduced to
 * digits, so the client logs in with something they already know by heart.
 * Returns null when the stored phone is too short to be a real number, in which
 * case the caller must ask for the username explicitly.
 * @param phone The customer's stored phone number, in any format
 */
export function buildClientUsername(phone: string | null | undefined): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

// ── Brute-force protection for the client portal login ──

/** Consecutive wrong passwords before the account is temporarily locked. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/** How long a locked account stays locked. */
export const LOGIN_LOCK_MINUTES = 15;

export type LoginAttemptState = {
  failedLoginAttempts: number;
  lockedUntil: Date | string | null;
};

/** Whether the account is currently inside a lockout window. */
export function isLoginLocked(state: LoginAttemptState, now: Date): boolean {
  if (!state.lockedUntil) return false;
  const until = state.lockedUntil instanceof Date ? state.lockedUntil : new Date(state.lockedUntil);
  return !Number.isNaN(until.getTime()) && until > now;
}

/** Whole minutes still remaining on a lockout, rounded up; 0 when not locked. */
export function minutesUntilUnlock(state: LoginAttemptState, now: Date): number {
  if (!isLoginLocked(state, now)) return 0;
  const until = state.lockedUntil instanceof Date ? state.lockedUntil : new Date(state.lockedUntil as string);
  return Math.ceil((until.getTime() - now.getTime()) / 60000);
}

/**
 * The counter state to persist after a wrong password. Reaching the limit locks
 * the account and resets the counter, so the next window starts clean.
 */
export function registerFailedLogin(state: LoginAttemptState, now: Date): LoginAttemptState {
  const attempts = state.failedLoginAttempts + 1;

  if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    return {
      failedLoginAttempts: 0,
      lockedUntil: new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60000),
    };
  }

  return { failedLoginAttempts: attempts, lockedUntil: null };
}
