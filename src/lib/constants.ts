// ── Project Status Constants ──
export const PROJECT_STATUS = {
  NEW: "new",
  SETUP: "setup",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  ON_HOLD: "on_hold",
  DELAYED: "delayed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const ACTIVE_STATUSES = [
  PROJECT_STATUS.IN_PROGRESS,
  PROJECT_STATUS.SETUP,
  PROJECT_STATUS.ASSIGNED,
] as const;

// ── Task Type Constants ──
export const TASK_TYPE = {
  SEO: "SEO",
  SOCIAL_MEDIA: "Social_Media",
  MEDIA_BUYER: "Media_Buyer",
  GRAPHIC_DESIGN: "graphic_design",
  MOTION_GRAPHIC: "motion_graphic",
  UI_DESIGN: "ui_design",
  CONTENT_SEO: "content_seo",
} as const;

// ── Task Status Constants ──
export const TASK_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  DONE: "done",
} as const;

// ── Role Constants ──
export const ADMIN_ROLES = [
  "super_admin",
] as const;

export const MANAGEMENT_ROLES = [
  "super_admin",
  "head_account_manager",
  "chief_sales",
  "head_technical",
  "head_seo",
] as const;

export const ACCOUNT_MANAGER_ROLES = [
  "super_admin",
  "head_account_manager",
  "account_manager",
] as const;

export const SEO_ROLES = [
  "super_admin",
  "head_seo",
  "team_leader_seo",
  "agent_seo",
  "agent_content_seo",
] as const;

export const SOCIAL_MEDIA_ROLES = [
  "super_admin",
  "team_leader_social_media",
  "agent_social_media",
] as const;

export const DESIGN_ROLES = [
  "super_admin",
  "leader_graphic_designer",
  "leader_motion_graphic",
  "leader_ui",
  "agent_graphic_designer",
  "agent_motion_graphic",
  "agent_ui",
] as const;

// ── Severity Levels ──
export const SEVERITY = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
} as const;

// ── Media Buyer Roles ──
export const MEDIA_BUYER_ROLES = [
  "super_admin",
  "team_leader_media_buyer",
  "agent_media_buyer",
] as const;

// ── Currency ──
export const CURRENCY = "SAR";

// ── Client Lifecycle State Constants ──
export const LIFECYCLE_STATE = {
  ACTIVE: "Active",
  HOLD: "Hold",
  RENEWER: "Renewer",
  LOST: "Lost",
} as const;

// ── Arabic labels shown in the UI for each lifecycle state ──
export const LIFECYCLE_STATE_LABELS_AR: Record<string, string> = {
  [LIFECYCLE_STATE.ACTIVE]: "اكتف",
  [LIFECYCLE_STATE.HOLD]: "هولد",
  [LIFECYCLE_STATE.RENEWER]: "تم التجديد",
  [LIFECYCLE_STATE.LOST]: "فقد",
};

/** Arabic label for a lifecycle state, falling back to the raw value. */
export function getLifecycleLabelAr(state: string | null | undefined): string {
  if (!state) return "";
  return LIFECYCLE_STATE_LABELS_AR[state] || state;
}

// ── Lifecycle states that pause delivery work ──
// A client on Hold is temporarily paused and a Lost client has left, so neither
// may receive new tasks or move existing ones forward. Active and Renewer are
// both "the client is being served" states and never block.
export const WORK_BLOCKING_LIFECYCLE_STATES = [
  LIFECYCLE_STATE.HOLD,
  LIFECYCLE_STATE.LOST,
] as const;

// ── Allowed Lifecycle Transitions ──
// Any state can move to any other: the Account Manager stays in full control
// and can correct a wrong status (e.g. bring a Lost client back).
export const LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  Active: ["Hold", "Renewer", "Lost"],
  Hold: ["Active", "Renewer", "Lost"],
  Renewer: ["Active", "Hold", "Lost"],
  Lost: ["Active", "Hold", "Renewer"],
};

// ── Operations Department Identifiers ──
export const OPERATIONS_DEPARTMENTS = [
  "social_media",
  "media_buyer",
  "seo",
  "graphic_design",
  "motion_graphic",
  "ui_design",
  "content_seo",
] as const;

// ── Roles allowed to change client lifecycle state ──
export const LIFECYCLE_CHANGE_ROLES = [
  "account_manager",
  "head_account_manager",
  "super_admin",
] as const;

// ── Roles allowed to issue warnings ──
export const WARNING_ISSUER_ROLES = [
  "account_manager",
  "sales_agent",
  "sales_manager",
  "head_account_manager",
  "super_admin",
] as const;

// ── Cross-team task types (tasks that route to creative leads) ──
export const CROSS_TEAM_TASK_TYPES = [
  "graphic_design",
  "motion_graphic",
  "ui_design",
  "content_seo",
] as const;

// ── Mapping from cross-team task type to the leader role that receives it ──
// Content SEO tasks are routed to the Head SEO, who distributes them to the
// Content SEO agents (the Head SEO is the content team's leader/manager).
export const TASK_TYPE_TO_LEADER_ROLE: Record<string, string> = {
  graphic_design: "leader_graphic_designer",
  motion_graphic: "leader_motion_graphic",
  ui_design: "leader_ui",
  content_seo: "head_seo",
};

const DEFAULT_TASK_CHECKLISTS: Record<string, Array<{ id: string; title: string; completed: boolean }>> = {
  SEO: [
    { id: "seo-keywords", title: "Keyword research and intent map", completed: false },
    { id: "seo-audit", title: "Technical and on-page audit", completed: false },
    { id: "seo-optimization", title: "On-page optimization updates", completed: false },
    { id: "seo-report", title: "Progress report and next actions", completed: false },
  ],
  seo: [
    { id: "seo-keywords", title: "Keyword research and intent map", completed: false },
    { id: "seo-audit", title: "Technical and on-page audit", completed: false },
    { id: "seo-optimization", title: "On-page optimization updates", completed: false },
    { id: "seo-report", title: "Progress report and next actions", completed: false },
  ],
  content_seo: [
    { id: "content-brief", title: "Review keyword brief and client context", completed: false },
    { id: "content-outline", title: "Prepare SEO content outline", completed: false },
    { id: "content-draft", title: "Write and optimize content draft", completed: false },
    { id: "content-link", title: "Attach final document link", completed: false },
  ],
};

export function getDefaultChecklistForTaskType(taskType: string): string {
  return JSON.stringify(DEFAULT_TASK_CHECKLISTS[taskType] || []);
}

// ── Team Leader roles (used for filtering) ──
export const TEAM_LEADER_ROLES = [
  "team_leader_social_media",
  "team_leader_media_buyer",
  "team_leader_seo",
  "leader_graphic_designer",
  "leader_motion_graphic",
  "leader_ui",
] as const;

// Roles that can be selected as an employee's direct manager in HR/User Management.
export const DIRECT_MANAGER_ROLES = [
  ...MANAGEMENT_ROLES,
  "hr_manager",
  "tele_sales_manager",
  "sales_manager",
  ...TEAM_LEADER_ROLES,
] as const;

// ── All agent distribution roles (Team Leaders that can assign to agents) ──
export const AGENT_ASSIGNER_ROLES = [
  "team_leader_social_media",
  "team_leader_media_buyer",
  "team_leader_seo",
  "leader_graphic_designer",
  "leader_motion_graphic",
  "leader_ui",
  "super_admin",
] as const;

// ── Helper: Check if user has one of allowed roles (super_admin always passes) ──
export function hasRole(userRole: string, allowedRoles: readonly string[]): boolean {
  return userRole === "super_admin" || allowedRoles.includes(userRole);
}
