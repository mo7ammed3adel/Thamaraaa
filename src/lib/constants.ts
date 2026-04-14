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

// ── Currency ──
export const CURRENCY = "SAR";

// ── Helper: Check if user has one of allowed roles ──
export function hasRole(userRole: string, allowedRoles: readonly string[]): boolean {
  return allowedRoles.includes(userRole);
}
