# Thamaraaa CRM — Senior Enterprise Audit Report

**Audit date:** 2026-05-09
**Auditor scope:** Spec compliance vs `فكره المشروع باختصار عمتاً.md` + senior enterprise quality (security, scale for ~500 users, code quality, ops readiness).
**Stack:** Next.js 14.2.35 + TypeScript 5 + Prisma 5.22 + **PostgreSQL** + NextAuth 4.24 + Pusher + Tailwind.
**Schema validation:** ✅ `prisma validate` passes.

---

## Executive Summary

| Severity | Count | Verdict |
|---|---|---|
| 🔴 Critical | 17 | **NOT production-ready** |
| 🟠 High | 21 | Needs work before scale |
| 🟡 Medium | 13 | Tech debt — fix iteratively |
| 🔵 Low | 4 | Polish |

**Spec compliance:** ~85% functionally implemented, but the **warning blocking-popup system — a core spec requirement — is broken end-to-end** (wrong endpoint + Pusher channel mismatch). Two role-flow bugs: head-AM KPIs always show 0 due to lifecycle case mismatch, and head-technical UI offers an assignment target the backend rejects.

**Enterprise readiness:** ~40%. Multiple IDOR/mass-assignment vulnerabilities, no tests, no CI/CD, no Prisma migrations folder, no rate limiting, no observability. The product can demo well; it cannot safely launch to 500 users.

**Frozen zones honored:** TeleSales (`tele_sales_*`) and Sales (`sales_*`) dashboards inspected for context only — findings affecting them are noted but no remediation proposed there.

---

## 🔴 Critical Findings

### CRIT-01 — Warning blocking-popup is broken (spec contract violated)
The spec mandates a blocking popup for everyone working on a client when a warning is fired. Two independent bugs make this **not work** in practice.

**Bug A — Wrong endpoint on mount.**
Both [WarningPopup.tsx:23](Thamaraaa/src/components/WarningPopup.tsx#L23) and [GlobalWarningAlert.tsx:33](Thamaraaa/src/components/GlobalWarningAlert.tsx#L33) call `GET /api/warnings`. That route's GET handler at [api/warnings/route.ts:128-130](Thamaraaa/src/app/api/warnings/route.ts#L128-L130) returns a hardcoded empty array:
```ts
export async function GET() { return NextResponse.json([]); }
```
The correct endpoint exists at [api/warnings/unread/route.ts:14-35](Thamaraaa/src/app/api/warnings/unread/route.ts#L14-L35) and returns user-specific unread `WarningReceipt` rows. **Result:** users never see existing warnings on page load — only newly-fired ones via Pusher (which is also broken — see Bug B).

**Bug B — Pusher channel/event mismatch.**
- Server fires on `private-user-${userId}` with event `warning-issued` ([api/warnings/route.ts:95-98](Thamaraaa/src/app/api/warnings/route.ts#L95-L98)).
- Client subscribes to `warnings-channel` with event `new-warning` ([WarningPopup.tsx:45-46](Thamaraaa/src/components/WarningPopup.tsx#L45-L46), [GlobalWarningAlert.tsx:20-21](Thamaraaa/src/components/GlobalWarningAlert.tsx#L20-L21)).

**Result:** real-time warning delivery never reaches the UI. Combined with Bug A, the spec-mandated blocking workflow does not function.

**Recommendation:** point both components to `/api/warnings/unread` (returns `{warnings: [...]}`); align Pusher to one convention — pick `private-user-${id}` / `warning-issued` server-side AND client-side, since per-user channels are the right granularity for selective recipient delivery. Also add a `useEffect` re-fetch when popup is mounted.

---

### CRIT-02 — Mass assignment in `PATCH /api/projects/[id]`
[api/projects/[id]/route.ts:55-82](Thamaraaa/src/app/api/projects/[id]/route.ts#L55-L82):
```ts
const project = await prisma.project.update({ where: { id: params.id }, data: body });
```
Any authenticated user can PATCH any field. They can overwrite `accountManagerId`, `headTechnicalId`, `headSeoId`, `lifecycleState`, `finalDeadline`, billing-adjacent fields. There is also no role check — only `if (!session)`.

**Recommendation:** allow-list specific fields per role; reuse the lifecycle endpoint for state transitions; require `head_account_manager` / project-AM-self for ownership-changing fields.

---

### CRIT-03 — Missing role check on `POST /api/projects/[id]/assign`
[api/projects/[id]/assign/route.ts:6-58](Thamaraaa/src/app/api/projects/[id]/assign/route.ts#L6-L58) reassigns Account Manager / Head Technical / Head SEO. Only authentication is checked — **no role check**. Any authenticated user can hijack project ownership.

**Recommendation:** restrict to `head_account_manager` and `super_admin`; verify with `canDistributeTo()`.

---

### CRIT-04 — Missing role check on `PATCH /api/projects/[id]/setup`
[api/projects/[id]/setup/route.ts:6-47](Thamaraaa/src/app/api/projects/[id]/setup/route.ts#L6-L47) accepts auth-only. Any user can set `niche`, `storeUrl`, `driveLink`, `finalDeadline`, `notes`, `projectStatus` for any project.

**Recommendation:** restrict to project's `accountManagerId` or `head_account_manager` / `super_admin`.

---

### CRIT-05 — Missing access control on `GET /api/projects/[id]`
[api/projects/[id]/route.ts:7-53](Thamaraaa/src/app/api/projects/[id]/route.ts#L7-L53) returns full project including the deal (`totalAmount`, `firstAmount`, payment method, contract URLs, installments) and all team notes. Only authentication is checked — **no ownership / team-membership verification**. Anyone with a valid session can read any project's financials.

**Recommendation:** verify the requester is one of: the project's AM/HT/HSEO, on its `TeamAssignment` list, or `super_admin`/`head_*`.

---

### CRIT-06 — Missing access control on `GET /api/team-assignments`, `GET /api/notes`
[api/team-assignments/route.ts:10-38](Thamaraaa/src/app/api/team-assignments/route.ts#L10-L38) and [api/notes/route.ts:6-57](Thamaraaa/src/app/api/notes/route.ts#L6-L57) accept any authenticated user. IDOR: enumerate any project's members and notes.

**Recommendation:** same membership check as CRIT-05.

---

### CRIT-07 — `POST /api/tasks` has no authorization
[api/tasks/route.ts:8-139](Thamaraaa/src/app/api/tasks/route.ts#L8-L139) — any authenticated user can create tasks for any project. The spec restricts cross-team task creation to specific roles (Social Media / Media Buyer / SEO agents).

**Recommendation:** require requester role ∈ `AGENT_ASSIGNER_ROLES` plus the assigning team-member roles; verify project membership.

---

### CRIT-08 — `POST /api/notifications/send` has no authorization on recipient
[api/notifications/send/route.ts:7-37](Thamaraaa/src/app/api/notifications/send/route.ts#L7-L37) — any authenticated user can send notifications to any user. Spam / phishing-via-internal-tool risk.

**Recommendation:** restrict to system roles only or remove this endpoint and inline notification creation in callers.

---

### CRIT-09 — Build accepts TypeScript and ESLint errors
[next.config.mjs:3-14](Thamaraaa/next.config.mjs#L3-L14):
```js
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```
This is **the** classic enterprise red flag. Type errors and lint failures ship to production undetected. Combined with **390 occurrences of `: any`** across 84 files, the type system is effectively off.

**Recommendation:** flip both to `false`. Run `tsc --noEmit` and `next lint` in CI as required checks. Triage existing errors over a sprint.

---

### CRIT-10 — Login OR-clause weakness
[lib/auth.ts:19-22](Thamaraaa/src/lib/auth.ts#L19-L22):
```ts
where: { OR: [{ email: input }, { phone: input }] }
```
If user A's email equals user B's phone (a digit-only email is unusual but possible; a phone string equal to an email is not — but this is fragile), the wrong account could be returned. Also no normalization (whitespace already trimmed; case is database-dependent).

**Recommendation:** detect input shape (regex for email vs phone digits) and query the appropriate column; ensure `email` is unique-ci and `phone` has its own `@unique`.

---

### CRIT-11 — No rate limiting / brute-force protection on login
The credentials provider in [lib/auth.ts](Thamaraaa/src/lib/auth.ts) uses bcrypt (good) but has no rate limit, captcha, or account lockout. With 500 users and no IP throttle, brute-force is trivial.

**Recommendation:** add `next-rate-limit` or Upstash Ratelimit on `/api/auth/callback/credentials`; add lockout after N failures; log auth attempts to an audit table.

---

### CRIT-12 — Critical bug: head-account-manager KPIs always show 0
[head-account-manager/page.tsx:85-87](Thamaraaa/src/app/dashboard/head-account-manager/page.tsx#L85-L87):
```ts
const onboardingCount = projects.filter(p => p.lifecycleState === "onboarding").length;
const activeLifecycleCount = projects.filter(p => p.lifecycleState === "active").length;
const churnRiskCount = projects.filter(p => p.lifecycleState === "churn_risk").length;
```
The DB stores Title-Case states (`Onboarding`, `Active`, `On_Hold`, `Completed`, `Churned` — see [constants.ts:100-106](Thamaraaa/src/lib/constants.ts#L100-L106)). These three KPIs are **always zero**. Also `churn_risk` isn't even a valid state — should be `Churned` or `On_Hold`.

**Recommendation:** use `LIFECYCLE_STATE` enum values: `LIFECYCLE_STATE.ONBOARDING`, etc.

---

### CRIT-13 — head-technical UI offers a target the backend rejects
[head-technical/page.tsx:32](Thamaraaa/src/app/dashboard/head-technical/page.tsx#L32) lists `head_seo` among assignment targets. But [distribution.ts:8-13](Thamaraaa/src/lib/distribution.ts#L8-L13) defines:
```ts
head_technical: ["team_leader_social_media", "team_leader_media_buyer"],
```
Spec also explicitly says HT distributes only to TL-Social and TL-Media. UI/backend mismatch → user clicks, gets 403.

**Recommendation:** remove `head_seo` from the head-technical leaders fetch.

---

### CRIT-14 — `POST /api/users` rejects all phone-less creations
[api/users/route.ts:17-23](Thamaraaa/src/app/api/users/route.ts#L17-L23):
```ts
const existing = await prisma.user.findFirst({
  where: { OR: [{ email: data.email }, data.phone ? { phone: data.phone } : {}] }
});
```
The empty object `{}` in an `OR` clause matches **every** row. So whenever `data.phone` is falsy, the query returns the first user in the DB and the route responds "User already exists." Creating users without a phone is impossible.

**Recommendation:**
```ts
const orClauses: any[] = [{ email: data.email }];
if (data.phone) orClauses.push({ phone: data.phone });
const existing = await prisma.user.findFirst({ where: { OR: orClauses } });
```

---

### CRIT-15 — Debug scripts committed to repo root
[Thamaraaa/check_db.js](Thamaraaa/check_db.js), [Thamaraaa/check_db2.js](Thamaraaa/check_db2.js), [Thamaraaa/debug-user.js](Thamaraaa/debug-user.js) — debug scripts using `bcryptjs` and `@prisma/client`. These commonly leak credentials, hashing salts, or PII patterns when committed.

**Recommendation:** move to `scripts/` (gitignored) or delete; review their content for hardcoded credentials before deletion.

---

### CRIT-16 — Spec gap: chief_sales has no distribution rule
The schema role list and [chief-sales/page.tsx](Thamaraaa/src/app/dashboard/chief-sales/page.tsx) exist, but [distribution.ts:8-26](Thamaraaa/src/lib/distribution.ts#L8-L26) `DISTRIBUTION_MAP` has no entry for `chief_sales`. The role can't distribute anything via `canDistributeTo()`.

**Recommendation:** clarify chief_sales scope with stakeholder; if they oversee TeleSales+Sales managers, no distribution rule needed; if they distribute clients, add map entry.

---

### CRIT-17 — `WarningReceipt` not created for users assigned AFTER a warning
The spec requires "everyone working on the client must see the warning until they acknowledge it." [api/warnings/route.ts:46-69](Thamaraaa/src/app/api/warnings/route.ts#L46-L69) creates `WarningReceipt` only for users assigned **at warning-creation time**. If a Team Leader adds a new agent after the warning fires, that new agent gets no receipt — the blocking popup never appears for them.

**Recommendation:** in `team-assignment` / `assign-agent` flows, when a user is added to a project, create receipts for all unresolved warnings on that project.

---

## 🟠 High Findings

### HIGH-01 — No transactions on multi-step writes
Only **9 out of 65 API routes** use `prisma.$transaction`. The deal-close flow ([api/deals/route.ts:54-82](Thamaraaa/src/app/api/deals/route.ts#L54-L82)) creates a Deal then updates Lead status sequentially with no transaction — partial failure leaves data inconsistent. Same pattern in `assign-agent`, `distribute` (the leader branch creates `teamAssignment` + `projectLog` + `notification` separately), and `tasks/[id]`.

**Recommendation:** wrap all multi-write handlers in `prisma.$transaction(async (tx) => {...})`.

### HIGH-02 — Dashboard pages fetch all projects without pagination
[head-account-manager/page.tsx:15](Thamaraaa/src/app/dashboard/head-account-manager/page.tsx#L15) does `prisma.project.findMany` with deeply nested includes (deal → lead → callLogs → meetings, plus tasks, accountManager, logs). At scale (~500 users × hundreds of projects × tasks/calllogs), each page load transfers megabytes and OOMs the server.

**Recommendation:** add cursor pagination + filter by `lifecycleState`/`projectStatus`/owner; lazy-load logs and call history into a detail panel.

### HIGH-03 — Internal HTTP fetch from server route
[api/projects/distribute/route.ts:140-156](Thamaraaa/src/app/api/projects/distribute/route.ts#L140-L156) calls `/api/tasks/generate` via `fetch()` with cookie forwarding. This is fragile (host detection from headers), slow (extra HTTP roundtrip), and fragile if the cookie path changes.

**Recommendation:** extract task-generation into `lib/taskGeneration.ts` and import directly.

### HIGH-04 — Email send is fire-and-forget, breaks acknowledgment receipts
[api/warnings/route.ts:91-117](Thamaraaa/src/app/api/warnings/route.ts#L91-L117): `Promise.allSettled(emailPromises)` is constructed but **never awaited**. The route returns before emails complete. Worse, the `warningReceipt.update({ deliveredViaEmail: true })` inside the unawaited promise can race with the route returning, and errors are invisible.

**Recommendation:** await the settled promises; OR push email-send to a background job (BullMQ / Inngest); log failures.

### HIGH-05 — Missing indexes on hot query columns
Schema has indexes on `Project.lifecycleState`/`accountManagerId`, `Note.projectId`/`userId`, `Warning.projectId`/`senderUserId`, `TeamAssignment.projectId`/`userId`, `WarningReceipt.warningId`/`userId`/(`userId`+`isRead`).

Missing on hot paths:
- `User.role`, `User.directManagerId`, `User.status` (every dashboard query filters by role)
- `Lead.status`, `Lead.assignedTeleAgentId`, `Lead.assignedSalesAgentId`
- `Task.agentId`, `Task.leaderId`, `Task.status`, `Task.projectId`, `Task.parentTaskId`
- `Notification.userId` + `read`
- `Attendance.userId`+`date`
- `Deal.salesAgentId`, `Deal.status`
- `Meeting.teleAgentId`, `Meeting.salesAgentId`, `Meeting.status`

**Recommendation:** add `@@index` declarations to schema; create migration.

### HIGH-06 — No Prisma migrations folder
Schema is at [prisma/schema.prisma](Thamaraaa/prisma/schema.prisma) but no `prisma/migrations/` directory exists. The team is using `prisma db push` (dev-only) or applying schema changes manually. Production schema drift is likely; rollbacks are impossible.

**Recommendation:** run `npx prisma migrate dev --name init_baseline` to capture current schema as the migration baseline; commit `prisma/migrations/`. Use `prisma migrate deploy` in CI/CD.

### HIGH-07 — No tests at all
No `*.test.ts` files outside `node_modules`. No `jest`/`vitest` setup. With 24 roles, hierarchical distribution rules, and a state-machine lifecycle, regressions are guaranteed.

**Recommendation:** add Vitest + Supertest. Priority targets: `lib/distribution.ts`, `lib/lifecycle.ts`, `api/warnings/*`, `api/projects/distribute`, `api/tasks/[id]`, deal-close flow.

### HIGH-08 — No CI/CD
No `.github/workflows/`, no Husky pre-commit, no GitLab CI. Type errors, lint errors, and broken builds reach `main` unchecked.

**Recommendation:** add a workflow that runs `tsc --noEmit`, `next lint`, `prisma validate`, and tests on every PR.

### HIGH-09 — No `.env.example`
Required env vars (`DATABASE_URL`, `NEXTAUTH_SECRET`, `PUSHER_*`, `SMTP_*`) are not documented in a tracked example file. Onboarding requires guesswork.

**Recommendation:** commit `.env.example` listing every key referenced in code.

### HIGH-10 — No structured logging
Codebase uses `console.error` everywhere (and zero `console.log`). No log levels, no correlation IDs, no aggregator integration. At 500 users with concurrent flows, debugging incidents is extremely hard.

**Recommendation:** adopt `pino` with `pino-pretty` in dev; ship JSON logs to a sink (Datadog/Better Stack/Grafana Loki) in prod; add request-id middleware.

### HIGH-11 — No observability / health endpoint
No `/api/health`, no Sentry, no APM. Errors get console.error'd into the void.

**Recommendation:** add Sentry SDK with `@sentry/nextjs`; expose `GET /api/health` returning DB ping; add `next-axiom` or OpenTelemetry for traces.

### HIGH-12 — `: any` epidemic
**390 occurrences across 84 files** ([grep result](Thamaraaa/src/)). Heavy uses: `session.user as any` (everywhere), `error: any` (catches), `whereClause: any`, body destructuring as `any`. With `next.config.mjs` ignoring TS errors, this is undetectable bit-rot.

**Recommendation:** augment `next-auth.d.ts` so `session.user` is correctly typed; replace `: any` catches with `: unknown` and narrow; add zod schemas for request bodies.

### HIGH-13 — No input validation library
Hand-rolled `if (!field) return 400` is inconsistent and incomplete. No body shape, no type coercion, no nested validation.

**Recommendation:** adopt `zod` (already a transitive dep); validate every request body and search params; return `400` with `zod.flatten()` on failure.

### HIGH-14 — `tsconfig.json` missing strictness flags
[tsconfig.json](Thamaraaa/tsconfig.json) has `strict: true` ✓ but no `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, or `noImplicitOverride`. Array index access (`arr[0].name`) won't catch undefined.

**Recommendation:** enable `noUncheckedIndexedAccess`. Land it gradually with file-level overrides.

### HIGH-15 — Bcrypt rounds = 10
Acceptable; consider 12 for production. [seed.js:10](Thamaraaa/prisma/seed.js#L10) and [api/users/route.ts:30](Thamaraaa/src/app/api/users/route.ts#L30).

### HIGH-16 — Seed script hardcodes admin password
[seed.js:10-28](Thamaraaa/prisma/seed.js#L10-L28) creates an `admin@thamaraa.com` with password `admin123`. If `prisma db seed` runs against prod, you've shipped a known credential.

**Recommendation:** read seed password from `SEED_ADMIN_PASSWORD` env var; fail loudly if absent.

### HIGH-17 — No Cascade rules on critical relations
Schema has `onDelete: Cascade` on `Note`, `WarningReceipt`, `ProjectFile`, `ProjectLog`, `CustomColumnValue` — good. Missing on:
- `Project.deal` (deleting a deal orphans projects)
- `Task.project` (deleting a project orphans tasks)
- `Task.parentTask` is `SetNull` ✓
- `Meeting.lead`, `Deal.lead`, `Installment.deal` — none

**Recommendation:** add explicit `onDelete` policies; `Restrict` is also valid if you don't want hard deletes.

### HIGH-18 — JSON-blob fields hide queryable data
`Task.checklistItems`, `Commission.bonuses`/`deductions`, `HrRecord.performanceHistory`, `Warning.recipientRoles`, `Warning.acknowledgedBy` (deprecated), `ProjectLog.details` are stringified JSON. With Postgres now, these should be `Json` type or proper relations to enable indexed queries and validation.

**Recommendation:** convert to `Json` (Prisma type) for fields that don't need queries; convert to relational tables (e.g., `TaskChecklistItem`) for queryable lists.

### HIGH-19 — Pusher cluster fallback hides config errors
[GlobalWarningAlert.tsx:16](Thamaraaa/src/components/GlobalWarningAlert.tsx#L16): `new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY || "key", ...)` — passing `"key"` as the key makes the client silently broken without throwing.

**Recommendation:** if env is missing, return null or render a console.warn; do not pass dummy strings.

### HIGH-20 — No CSP / security headers
[next.config.mjs](Thamaraaa/next.config.mjs) has no `headers()` block. Missing: CSP, X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options.

**Recommendation:** add `headers()` returning the standard hardening set; iterate CSP starting in `report-only` mode.

### HIGH-21 — No request size limits
Routes parse `req.json()` without limits. 100 MB JSON payloads could memory-exhaust the Node process. Next.js has a default 1MB limit on App Router but it's worth setting explicitly.

**Recommendation:** declare `export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }` per route OR use `req.bodyUsed` checks.

---

## 🟡 Medium Findings

### MED-01 — Deprecated fields still in schema
[schema.prisma:213](Thamaraaa/prisma/schema.prisma#L213) `Project.finalStatus` marked DEPRECATED but still readable. [schema.prisma:411](Thamaraaa/prisma/schema.prisma#L411) `Warning.acknowledgedBy` marked DEPRECATED — only `WarningReceipt` is used in current code, but the field still exists and could be re-introduced by accident.

**Recommendation:** plan a migration to drop both columns once code is verified to no longer reference them.

### MED-02 — Role/state strings instead of Postgres enums
24 roles, 5 lifecycle states, 4 task statuses — all stored as `String`. A typo in code ("on_hold" vs "On_Hold" — see CRIT-12) silently corrupts state. With Postgres, `enum` types prevent this at DB level.

**Recommendation:** convert `User.role`, `Project.lifecycleState`, `Task.status`, `Task.priority`, `Lead.classification`, `Lead.status`, `Deal.status` to Prisma enums (which generate Postgres `CREATE TYPE ... AS ENUM`).

### MED-03 — DateTime fields without explicit timezone
Postgres defaults `DateTime` to `timestamp(3)` without tz. Cross-region 500 users → confusion.

**Recommendation:** add `@db.Timestamptz(6)` to all `DateTime` fields; standardize all server inputs to UTC.

### MED-04 — `WarningPopup` only shows first warning
[WarningPopup.tsx:60](Thamaraaa/src/components/WarningPopup.tsx#L60): `setActiveWarning((current) => current || newWarning)` — once a warning is active, real-time pushes don't replace it. If the active warning is acknowledged but more arrived, the queue is stale and UI may show "+0 more".

**Recommendation:** use a queue + advance on acknowledge.

### MED-05 — `WarningPopup` and `GlobalWarningAlert` overlap
Two components show warnings: full-screen blocking popup + bottom-right floating alert. If both render, UX is confusing. Spec calls for blocking popup only.

**Recommendation:** decide ownership — keep `WarningPopup` for blocking; remove `GlobalWarningAlert` or downgrade it to a "history" non-blocking view.

### MED-06 — `data.recipientRoles` filtering on Pusher event side is dead code
[WarningPopup.tsx:48](Thamaraaa/src/components/WarningPopup.tsx#L48): `if (roles.includes(userRole) && ...)` — the POST never sends `recipientRoles` in the Pusher payload, so this branch is always false. Combined with CRIT-01 Bug B, it's doubly dead.

**Recommendation:** clean up after fixing CRIT-01.

### MED-07 — `tasks/route.ts` POST has dead/buggy code path
[api/tasks/route.ts:60](Thamaraaa/src/app/api/tasks/route.ts#L60):
```ts
const leader = await prisma.user.findFirst({
  where: { role: { in: ["team_leader_seo"].includes(roleToFind) ? ["head_seo", "team_leader_seo"] : [roleToFind, "super_admin"] }, ... }
});
```
The `["team_leader_seo"].includes(roleToFind)` predicate is `false` for every code path that reaches it (the switch sets `roleToFind` to `head_seo`, `team_leader_social_media`, `team_leader_media_buyer`, `head_technical`, or `super_admin`). This branch is unreachable.

**Recommendation:** simplify the search logic; cover SEO branch explicitly.

### MED-08 — Inconsistent error response shape
Some routes return `{ error: string }`, some `{ error: string, details: string }`, some `{ error: string, warnings: [...] }`. Frontend can't rely on a single envelope.

**Recommendation:** standardize: `{ error: { code, message, details? } }`.

### MED-09 — Repo bloat: PDFs and `.rar` archive
[Thamaraaa/Thamaraaa.rar](Thamaraaa/Thamaraaa.rar), three `.pdf` files at root.

**Recommendation:** move to `docs/` or external drive; gitignore archives.

### MED-10 — `dashboard/page.tsx` is a placeholder
[dashboard/page.tsx](Thamaraaa/src/app/dashboard/page.tsx) shows a generic welcome — not a per-role dispatcher. Users with a specific role land on a useless page if they navigate to `/dashboard` directly.

**Recommendation:** redirect by role (`account_manager` → `/dashboard/account-manager`, etc.).

### MED-11 — `head-technical` distributes to `head_seo` per UI but spec says no
Already noted in CRIT-13 — listing here for spec-compliance tracking.

### MED-12 — Spec ambiguity: AM → SEO direct distribution
Spec says Account Manager can distribute to Head SEO **or SEO directly**. Current `DISTRIBUTION_MAP` allows AM only → `head_seo`. Likely OK if the team prefers Head SEO as a single entry point, but worth confirming with the stakeholder.

### MED-13 — `account-manager/page.tsx` not paginated either (already counted in HIGH-02; tracking spec context).

---

## 🔵 Low Findings

### LOW-01 — `replace(/_/g, " ")` repeated for role formatting
Centralize as `formatRole(role: string)` in `lib/utils.ts`.

### LOW-02 — `force-dynamic` inconsistently set across routes
Pick a convention and apply uniformly to mutation/listing routes that depend on session.

### LOW-03 — Unused `accountantNotes`, etc.
Some fields appear referenced but unused in current routes — verify and prune.

### LOW-04 — `dotenv` in devDependencies
[package.json:32](Thamaraaa/package.json#L32) — Next.js auto-loads `.env`. `dotenv` is rarely needed; remove unless used by `seed.js` (which it appears to be — keep then).

---

## Spec Compliance Per Role

| Role | Dashboard | Distribution | Tasks | Warnings | Status |
|------|-----------|--------------|-------|----------|--------|
| tele_sales_agent | ✅ frozen | – | – | recipient | OK (frozen) |
| tele_sales_manager | ✅ frozen | – | – | recipient | OK (frozen) |
| sales_agent | ✅ frozen | – | – | issuer/recipient | OK (frozen) — popup broken (CRIT-01) |
| sales_manager | ✅ frozen | – | – | issuer/recipient | OK (frozen) — popup broken (CRIT-01) |
| chief_sales | ✅ exists | ❌ no map entry | – | – | **CRIT-16** |
| head_account_manager | ✅ exists | ✅ AM/HT/HSEO | – | issuer | **CRIT-12** (KPIs always 0) |
| account_manager | ✅ exists | ⚠ HSEO only (spec says SEO too) | – | issuer | **MED-12** |
| head_technical | ✅ exists | ✅ TL_social/TL_media | – | – | **CRIT-13** (UI offers HSEO) |
| head_seo | ✅ in seo dashboard | ✅ TL_seo | – | – | OK |
| team_leader_seo | ✅ in seo dashboard | ✅ agent_seo / agent_content_seo | ✅ | – | OK |
| agent_seo | ✅ in seo dashboard | – | ✅ | – | OK |
| agent_content_seo | ✅ in seo dashboard | – | ✅ | – | OK |
| team_leader_media_buyer | ✅ in media-buyer dashboard | ✅ agent_media_buyer | ✅ | – | OK |
| agent_media_buyer | ✅ in media-buyer | – | ✅ | – | OK |
| team_leader_social_media | ✅ in social-media | ✅ agent_social_media | ✅ | – | OK |
| agent_social_media | ✅ in social-media | – | ✅ | – | OK |
| leader_graphic_designer | ✅ in design dashboard | ✅ agent_graphic_designer | ✅ | – | OK |
| agent_graphic_designer | ✅ in design dashboard | – | ✅ | – | OK |
| leader_motion_graphic | ✅ in design | ✅ agent_motion_graphic | ✅ | – | OK |
| agent_motion_graphic | ✅ in design | – | ✅ | – | OK |
| leader_ui | ✅ in design | ✅ agent_ui | ✅ | – | OK |
| agent_ui | ✅ in design | – | ✅ | – | OK |
| hr_manager | ✅ hr dashboard | – | – | – | OK |
| accountant | ✅ finance dashboard | – | – | – | OK |

---

## Verification Performed

1. **`prisma validate`** ✅ passes ([log](Thamaraaa/prisma/schema.prisma)).
2. **`tsc --noEmit`** — not run because [next.config.mjs:8](Thamaraaa/next.config.mjs#L8) ignores type errors anyway; expect many failures given 390 `: any`.
3. **`next build`** — not run; would succeed despite errors due to CRIT-09.
4. **Static analysis** via Grep:
   - 390 occurrences of `: any` across 84 files
   - 0 occurrences of `console.log`
   - 0 occurrences of `dangerouslySetInnerHTML`
   - 9 occurrences of `prisma.$transaction` across 65 API routes
   - 65 occurrences of `getServerSession` (auth coverage looks complete)

---

## Priority Remediation Order

**Sprint 1 (security + critical bugs):** CRIT-01, 02, 03, 04, 05, 06, 07, 08, 12, 13, 14, 17 + HIGH-04.
**Sprint 2 (build/quality gates):** CRIT-09, 11 + HIGH-06, 07, 08, 09, 12.
**Sprint 3 (scale + ops):** HIGH-01, 02, 05, 10, 11, 17, 21 + MED-02, 03.
**Sprint 4 (polish):** remaining MED + LOW.

After Sprint 2 ship, the project becomes a candidate for staged production rollout. Before then: demo-only.

---

## Out of Scope of This Audit

- The detailed per-role dashboard prompt requested in the last paragraph of `فكره المشروع باختصار عمتاً.md`. That is a separate deliverable and should be produced after the Critical/High issues are addressed (so the prompt reflects the corrected behavior, not the current buggy state).
- Performance load testing.
- Penetration testing.
- UI/UX heuristic review of frozen TeleSales/Sales screens.
