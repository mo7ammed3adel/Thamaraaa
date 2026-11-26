/**
 * The general manager sees and creates everything the super admin can, but
 * changing or removing existing data needs a grant from the super admin
 * (User.gmCanEdit / User.gmCanDelete). This decides, from an API request
 * alone, whether it is an edit, a delete, or neither. Edge-safe (no Node or
 * database imports): the middleware calls it on every API request.
 *
 * POST is judged by an allow-list of routes that only CREATE something; any
 * other POST counts as an edit. A new route is therefore guarded by default
 * until it is deliberately listed here as create-only.
 */

export type GuardedAction = "edit" | "delete";

const ID = "[^/]+";
const re = (path: string) => new RegExp(`^${path.replace(/:id/g, ID)}$`);

/**
 * Personal, self-service areas: a GM's own chat, photo, password,
 * notifications, attendance and acknowledgements are never "editing the
 * company's data". (Routes here must act only on the caller themselves.)
 */
const PERSONAL = [
  /^\/api\/chat\//,
  /^\/api\/me\//,
  /^\/api\/account\//,
  /^\/api\/avatars\//,
  /^\/api\/notifications(\/|$)/,
  /^\/api\/auth\//,
  re("/api/warnings/:id/acknowledge"),
  re("/api/tasks/self"),
  re("/api/attendance"),
  // Starting an impersonation is guarded in its route; stopping just returns to yourself.
  re("/api/admin/impersonate"),
];

/** POST routes that only create new records. */
const POST_CREATES = [
  "/api/call-logs",
  "/api/client-accounts",
  "/api/companies",
  "/api/custom-columns",
  "/api/deals",
  "/api/devices",
  "/api/hr/applicants",
  "/api/hr/central-requests",
  "/api/hr/complaints",
  "/api/hr/departments",
  "/api/hr/departments/:id/documents",
  "/api/hr/documents",
  "/api/hr/employees",
  "/api/hr/requests",
  "/api/hr/reviews",
  "/api/hr/salary-advance",
  "/api/leads",
  "/api/leads/import",
  "/api/niches",
  "/api/notes",
  "/api/notifications/send",
  "/api/packages",
  "/api/projects/:id/files",
  "/api/projects/setup",
  "/api/tasks",
  "/api/tasks/generate",
  "/api/users",
  "/api/warnings",
].map(re);

const POST_DELETES = [re("/api/leads/bulk/delete"), re("/api/admin/wipe-test-data")];

export function guardedAction(method: string, pathname: string, selfId?: string | null): GuardedAction | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (!path.startsWith("/api/") || PERSONAL.some((r) => r.test(path))) return null;
  // Your own presence (online/away) is yours to set.
  if (selfId && path === `/api/users/${selfId}/status`) return null;
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return null;
  if (m === "DELETE") return "delete";
  if (m === "POST") {
    if (POST_DELETES.some((r) => r.test(path))) return "delete";
    return POST_CREATES.some((r) => r.test(path)) ? null : "edit";
  }
  // PATCH, PUT and anything unexpected.
  return "edit";
}
