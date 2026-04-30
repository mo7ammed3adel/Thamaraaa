# Tasks: ERP Operations System

**Input**: Design documents from `/specs/001-erp-operations-system/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api-contracts.md ✅, quickstart.md ✅

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, add environment variables, and configure tooling before any code changes.

- [x] T001 Install `nodemailer` and `@types/nodemailer` by running `npm install nodemailer` and `npm install -D @types/nodemailer` from the project root
- [x] T002 Add SMTP environment variables to `.env` file — add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (see `specs/001-erp-operations-system/quickstart.md` lines 17-22 for exact values)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema changes and core utility modules that ALL user stories depend on. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Schema & Migration

- [x] T003 Add `lifecycleState` field to the `Project` model in `prisma/schema.prisma`. Add this field: `lifecycleState String @default("Onboarding")`. This is a String field (NOT an enum) with default value `"Onboarding"`. Valid values are: `Onboarding`, `Active`, `On_Hold`, `Completed`, `Churned`. Also add an `@@index([lifecycleState])` for filtering. Do NOT remove existing `projectStatus` or `finalStatus` fields — they remain for backwards compatibility.

- [x] T004 Create the `TeamAssignment` model in `prisma/schema.prisma`. The model has these fields: `id String @id @default(uuid())`, `projectId String` (relation to Project), `userId String` (relation to User), `assignedByUserId String` (relation to User), `role String`, `department String`, `status String @default("active")`, `assignedAt DateTime @default(now())`, `removedAt DateTime?`. Add relations: `project Project @relation(fields: [projectId], references: [id])`, `user User @relation("TeamAssignmentUser", fields: [userId], references: [id])`, `assignedByUser User @relation("TeamAssignmentAssigner", fields: [assignedByUserId], references: [id])`. Add `@@unique([projectId, userId])` constraint. Add `@@index([projectId])` and `@@index([userId])`. Valid `department` values: `social_media`, `media_buyer`, `seo`, `graphic_design`, `motion_graphic`, `ui_design`, `content_seo`. Valid `status` values: `active`, `paused`, `completed`, `removed`.

- [x] T005 Create the `WarningReceipt` model in `prisma/schema.prisma`. The model has these fields: `id String @id @default(uuid())`, `warningId String` (relation to Warning), `userId String` (relation to User), `isRead Boolean @default(false)`, `readAt DateTime?`, `deliveredViaEmail Boolean @default(false)`, `emailSentAt DateTime?`, `createdAt DateTime @default(now())`. Add relations: `warning Warning @relation(fields: [warningId], references: [id], onDelete: Cascade)`, `user User @relation("WarningReceiptUser", fields: [userId], references: [id])`. Add `@@unique([warningId, userId])` constraint. Add `@@index([warningId])` and `@@index([userId])`.

- [x] T006 Modify the `Warning` model in `prisma/schema.prisma`. Add a `receipts WarningReceipt[]` relation. Ensure `projectId` has a proper relation to `Project` (add `project Project? @relation(fields: [projectId], references: [id])` if not already a proper FK relation). Keep the existing `acknowledgedBy` field for backwards compatibility but it will no longer be written to.

- [x] T007 Modify the `User` model in `prisma/schema.prisma`. Add these new relations: `teamAssignments TeamAssignment[] @relation("TeamAssignmentUser")`, `teamAssignmentsMade TeamAssignment[] @relation("TeamAssignmentAssigner")`, `warningReceipts WarningReceipt[] @relation("WarningReceiptUser")`.

- [x] T008 Modify the `Project` model in `prisma/schema.prisma`. Add these new relations: `teamAssignments TeamAssignment[]`. Ensure the `warnings Warning[]` relation exists (add if missing).

- [x] T009 Run `npx prisma migrate dev --name add-operations-system` from the project root to apply all schema changes, then run `npx prisma generate` to regenerate the Prisma client. Verify the migration succeeds without errors.

### Constants & Enums

- [x] T010 [P] Update `src/lib/constants.ts` to add these new constant objects. Add `LIFECYCLE_STATE` object: `{ ONBOARDING: "Onboarding", ACTIVE: "Active", ON_HOLD: "On_Hold", COMPLETED: "Completed", CHURNED: "Churned" }`. Add `LIFECYCLE_TRANSITIONS` object that maps the allowed transitions: `{ Onboarding: ["Active", "Churned"], Active: ["On_Hold", "Completed", "Churned"], On_Hold: ["Active", "Completed", "Churned"], Completed: ["Churned"], Churned: [] }`. Add `OPERATIONS_DEPARTMENTS` array: `["social_media", "media_buyer", "seo", "graphic_design", "motion_graphic", "ui_design", "content_seo"]`. Add `LIFECYCLE_CHANGE_ROLES` array: `["account_manager", "head_account_manager", "super_admin"]`. Add `WARNING_ISSUER_ROLES` array: `["account_manager", "sales_agent", "sales_manager", "head_account_manager", "super_admin"]`. Add `CROSS_TEAM_TASK_TYPES` array: `["graphic_design", "motion_graphic", "ui_design", "content_seo"]`. Add `TASK_TYPE_TO_LEADER_ROLE` mapping: `{ graphic_design: "leader_graphic_designer", motion_graphic: "leader_motion_graphic", ui_design: "leader_ui", content_seo: "team_leader_seo" }`. Export all of these.

### Core Utility Modules

- [x] T011 [P] Create `src/lib/lifecycle.ts` with two exported functions. (1) `validateLifecycleTransition(currentState: string, newState: string): { valid: boolean; error?: string }` — import `LIFECYCLE_STATE` and `LIFECYCLE_TRANSITIONS` from `./constants`. Check if `currentState` and `newState` are valid lifecycle states, then check if `newState` is in the allowed transitions array for `currentState`. Return `{ valid: true }` if allowed, or `{ valid: false, error: "..." }` with a descriptive message if not. (2) `canChangeLifecycle(userRole: string, userId: string, projectAccountManagerId: string | null): boolean` — import `LIFECYCLE_CHANGE_ROLES` from `./constants`. Return `true` if `userRole` is in `LIFECYCLE_CHANGE_ROLES`. If the role is `account_manager`, also verify that `userId === projectAccountManagerId` (only the assigned Account Manager can change state, not any Account Manager). `head_account_manager` and `super_admin` can always change state.

- [x] T012 [P] Create `src/lib/distribution.ts` with three exported functions. (1) `canDistributeTo(distributorRole: string, targetRole: string): boolean` — implement the allowed distribution map: `head_account_manager` can distribute to `["account_manager", "head_technical"]`; `head_technical` can distribute to `["team_leader_social_media", "team_leader_media_buyer"]`; `account_manager` can distribute to `["head_seo"]`; `head_seo` can distribute to `["team_leader_seo"]`; `team_leader_social_media` can distribute to `["agent_social_media"]`; `team_leader_media_buyer` can distribute to `["agent_media_buyer"]`; `team_leader_seo` can distribute to `["agent_seo"]`; `leader_graphic_designer` can distribute to `["agent_graphic_designer"]`; `leader_motion_graphic` can distribute to `["agent_motion_graphic"]`; `leader_ui` can distribute to `["agent_ui"]`. Return `true` if the target role is in the allowed list for the distributor role, `false` otherwise. (2) `getDistributionTargets(distributorRole: string): string[]` — return the array of allowed target roles for the given distributor role, or an empty array if the role has no distribution targets. (3) `findTeamLeaderRoleForTaskType(taskType: string): string | null` — import `TASK_TYPE_TO_LEADER_ROLE` from `./constants`. Return the leader role for the given task type, or `null` if the task type is not a valid cross-team task type.

- [x] T013 [P] Create `src/lib/email.ts` with one exported async function: `sendWarningEmail(to: string, subject: string, message: string, senderName: string): Promise<{ success: boolean; error?: string }>`. Use `nodemailer` to create a transporter using `process.env.SMTP_HOST`, `process.env.SMTP_PORT` (parse as number), `process.env.SMTP_USER`, `process.env.SMTP_PASSWORD`. Set `from` to `process.env.SMTP_FROM`. Send a plain-text email with the `subject` and `message` body including the sender name. Wrap in try-catch: on success return `{ success: true }`, on error return `{ success: false, error: error.message }`. Log errors to console but never throw — email failure should not block the warning creation flow. If SMTP env vars are missing, return `{ success: false, error: "SMTP not configured" }` without attempting to send.

**Checkpoint**: Foundation ready — schema migrated, constants defined, core utilities created. User story implementation can now begin.

---

## Phase 3: User Story 1 — Head Account Manager Receives & Distributes Closed Deals (Priority: P1) 🎯 MVP

**Goal**: When a deal closes, the Head Account Manager sees the new client in their dashboard with the complete client journey. They can assign the client to an Account Manager Agent AND distribute the technical scope to Head Technical.

**Independent Test**: Create a project record via Prisma Studio (simulating a closed deal). Log in as `head_account_manager`. Verify the project appears in the queue with journey data. Assign to an Account Manager. Distribute to Head Technical. Verify both assignments are logged in the project timeline.

### API Routes for User Story 1

- [ ] T014 [P] [US1] Create `src/app/api/projects/[id]/assign-account-manager/route.ts`. Export an async `POST` function. Steps: (1) Get session via `getServerSession(authOptions)` — return 401 if no session. (2) Check that `session.user.role` is `head_account_manager` or `super_admin` using the existing `hasRole()` from `src/lib/constants.ts` — return 403 if unauthorized. (3) Parse request body `{ accountManagerId: string }` — return 400 if missing. (4) Verify the target user exists and has role `account_manager` via `prisma.user.findUnique()` — return 404 if not found. (5) Update the project: `prisma.project.update({ where: { id: params.id }, data: { accountManagerId } })`. (6) Create a `ProjectLog` entry: `prisma.projectLog.create({ data: { projectId: params.id, userId: session.user.id, action: "assigned", details: "Assigned Account Manager: {user name}" } })`. (7) Create a `Notification`: `prisma.notification.create({ data: { userId: accountManagerId, type: "project_assigned", message: "You have been assigned a new project", projectId: params.id } })`. (8) Trigger Pusher event on channel `private-user-${accountManagerId}`, event `project-assigned`, data `{ projectId: params.id }` — use the existing Pusher server instance from `src/lib/pusher.ts`. (9) Return `{ success: true, project: { id, accountManagerId, lifecycleState } }`. Use a Prisma transaction (`prisma.$transaction`) for steps 5-7 to ensure atomicity.

- [ ] T015 [P] [US1] Create `src/app/api/projects/[id]/assign-head-technical/route.ts`. Export an async `POST` function. Same pattern as T014 but: (1) Roles allowed: `head_account_manager`, `super_admin`. (2) Body: `{ headTechnicalId: string }`. (3) Verify target user has role `head_technical`. (4) Update project: `prisma.project.update({ where: { id: params.id }, data: { headTechnicalId } })`. (5) Create ProjectLog with action `technical_distributed` and details `"Distributed to Head Technical: {name}"`. (6) Create Notification for the Head Technical user with type `team_distributed`. (7) Trigger Pusher event `project-assigned` on `private-user-${headTechnicalId}`. (8) Return `{ success: true, project: { id, headTechnicalId } }`. Use Prisma transaction.

- [ ] T016 [P] [US1] Create `src/app/api/projects/[id]/journey/route.ts`. Export an async `GET` function. Steps: (1) Session check + any authenticated user with project access (check that the user is either assigned to the project via `accountManagerId`, `headTechnicalId`, `headSeoId`, has a `TeamAssignment` for the project, or has a management role like `head_account_manager`, `super_admin`, `sales_manager`, or is the `salesAgentId` on the project's deal). (2) Fetch the project with ALL related data using Prisma includes: `include: { deal: { include: { lead: { include: { callLogs: true, meetings: true } }, salesAgent: { select: { id: true, name: true, role: true } } } }, notes: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, role: true } } } }, tasks: { include: { assignedUser: { select: { id: true, name: true, role: true } } } }, projectLogs: { orderBy: { createdAt: "asc" } }, warnings: { include: { sender: { select: { id: true, name: true, role: true } } } }, teamAssignments: { include: { user: { select: { id: true, name: true, role: true } } } }, accountManager: { select: { id: true, name: true, role: true } }, headTechnical: { select: { id: true, name: true, role: true } }, headSeo: { select: { id: true, name: true, role: true } } }`. (3) Build a chronological timeline array by merging all events (call logs, meetings, notes, project logs, tasks, warnings, team assignments) into a single array sorted by date. Each timeline entry should have: `{ type: string, date: string, data: object }`. (4) Return `{ journey: timelineArray, project: projectData }`.

### Components for User Story 1

- [ ] T017 [P] [US1] Create `src/components/LifecycleStateBadge.tsx`. This is a client component (`"use client"`). Props: `{ state: string; className?: string }`. Render a `<span>` with a colored badge based on the state. Color mapping: `Onboarding` → `bg-blue-100 text-blue-800`, `Active` → `bg-green-100 text-green-800`, `On_Hold` → `bg-amber-100 text-amber-800`, `Completed` → `bg-gray-100 text-gray-800`, `Churned` → `bg-red-100 text-red-800`. Display a user-friendly label (replace underscores with spaces). Use `clsx` or `cn()` utility from the existing codebase for className merging. Example output: `<span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>`.

- [ ] T018 [P] [US1] Create `src/components/WorkloadIndicator.tsx`. This is a client component (`"use client"`). Props: `{ taskCount: number; clientCount: number; maxTasks?: number }`. Default `maxTasks` to 10. Render a horizontal progress bar showing `taskCount / maxTasks` as a percentage. Color the bar using: green (`bg-green-500`) if percentage < 50%, amber (`bg-amber-500`) if 50-79%, red (`bg-red-500`) if >= 80%. Below the bar, show text: `"{taskCount} tasks · {clientCount} clients"`. Use Tailwind classes. The bar container should be `h-2 rounded-full bg-gray-200 overflow-hidden` with the filled portion using `style={{ width: \`${percentage}%\` }}`.

- [ ] T019 [P] [US1] Create `src/components/DistributionPanel.tsx`. This is a client component (`"use client"`). Props: `{ users: Array<{ id: string; name: string; role: string; taskCount: number; clientCount: number }>; onAssign: (userId: string) => void; title: string; isLoading?: boolean }`. Render a panel with: (1) A title header. (2) A list of users, each showing: name, role badge, `WorkloadIndicator` (import from `./WorkloadIndicator`), and an "Assign" button. (3) The "Assign" button should call `onAssign(user.id)` on click. (4) Show a loading spinner if `isLoading` is true. (5) Show "No users available" if the users array is empty. Use a card-style layout with `border rounded-lg p-4 shadow-sm`.

### Dashboard Page for User Story 1

- [ ] T020 [US1] Modify `src/app/dashboard/head-account-manager/page.tsx` (server component). Add data fetching for: (1) Unassigned projects (where `accountManagerId` is null and `lifecycleState` is `Onboarding`): `prisma.project.findMany({ where: { accountManagerId: null, lifecycleState: "Onboarding" }, include: { deal: true, projectLogs: true } })`. (2) All Account Manager users with their workload: `prisma.user.findMany({ where: { role: "account_manager" }, include: { _count: { select: { managedProjects: true } } } })`. (3) All Head Technical users: `prisma.user.findMany({ where: { role: "head_technical" } })`. (4) All assigned projects with lifecycle state: `prisma.project.findMany({ where: { accountManagerId: { not: null } }, include: { accountManager: { select: { id: true, name: true } }, headTechnical: { select: { id: true, name: true } }, teamAssignments: true }, orderBy: { updatedAt: "desc" } })`. Pass all data as props to the client component `HeadAccountManagerClient`.

- [ ] T021 [US1] Modify `src/app/dashboard/head-account-manager/HeadAccountManagerClient.tsx` (client component). Add the following sections to the existing dashboard: (1) **Incoming Clients Queue** — a list/table of unassigned projects (from props) with columns: client name, package type, deal value, date created, lifecycle badge (use `LifecycleStateBadge`). Each row has an "Assign" button. (2) **Assign Account Manager** — when "Assign" is clicked, show a modal or side panel containing `DistributionPanel` with the list of Account Manager users. The `onAssign` callback should `fetch("/api/projects/{id}/assign-account-manager", { method: "POST", body: JSON.stringify({ accountManagerId }) })`. After success, refresh the page data using `router.refresh()`. (3) **Distribute to Head Technical** — similar pattern: when a project has an Account Manager but no Head Technical, show a "Distribute Technical" button that opens `DistributionPanel` with Head Technical users. The `onAssign` callback should `fetch("/api/projects/{id}/assign-head-technical", { method: "POST", body: JSON.stringify({ headTechnicalId }) })`. (4) **Assigned Clients List** — a table of all assigned projects showing: client name, Account Manager name, Head Technical name (or "Not Distributed"), lifecycle state badge, last updated date. (5) Add a lifecycle state filter dropdown at the top that filters the assigned clients list by `lifecycleState`. Default to showing `Onboarding` and `Active`. Import `LifecycleStateBadge` from `@/components/LifecycleStateBadge`, `DistributionPanel` from `@/components/DistributionPanel`, `WorkloadIndicator` from `@/components/WorkloadIndicator`. Add Pusher subscription to `private-user-${session.user.id}` for `project-assigned` events to auto-refresh data.

**Checkpoint**: User Story 1 complete. The Head Account Manager can see incoming deals, assign Account Managers, and distribute to Head Technical.

---

## Phase 4: User Story 2 — Account Manager Agent Manages Client Operations & Team Visibility (Priority: P1)

**Goal**: The Account Manager sees all assigned clients, the complete journey from lead entry through deal closure, all teams working on the client, every task status, and can distribute SEO scope to Head SEO.

**Independent Test**: Assign a project to an Account Manager via Prisma Studio. Log in as that Account Manager. Verify they see the client with journey data, team overview, and can distribute to Head SEO.

### API Routes for User Story 2

- [ ] T022 [P] [US2] Create `src/app/api/projects/[id]/assign-head-seo/route.ts`. Export an async `POST` function. Steps: (1) Session check — roles allowed: `account_manager`, `head_account_manager`, `super_admin`. (2) If role is `account_manager`, verify `session.user.id === project.accountManagerId` (only the assigned AM can distribute SEO). (3) Body: `{ headSeoId: string }`. (4) Verify target user has role `head_seo`. (5) Update project: `prisma.project.update({ where: { id: params.id }, data: { headSeoId } })`. (6) Create ProjectLog with action `seo_distributed`. (7) Create Notification for Head SEO with type `team_distributed`. (8) Trigger Pusher event `project-assigned` on `private-user-${headSeoId}`. (9) Return `{ success: true, project: { id, headSeoId } }`. Use Prisma transaction.

- [x] T022 [P] [US2] Create `src/app/api/projects/[id]/assign-head-seo/route.ts`. Export an async `POST` function. Steps: (1) Session check — roles allowed: `account_manager`, `head_account_manager`, `super_admin`. (2) If role is `account_manager`, verify `session.user.id === project.accountManagerId` (only the assigned AM can distribute SEO). (3) Body: `{ headSeoId: string }`. (4) Verify target user has role `head_seo`. (5) Update project: `prisma.project.update({ where: { id: params.id }, data: { headSeoId } })`. (6) Create ProjectLog with action `seo_distributed`. (7) Create Notification for Head SEO with type `team_distributed`. (8) Trigger Pusher event `project-assigned` on `private-user-${headSeoId}`. (9) Return `{ success: true, project: { id, headSeoId } }`. Use Prisma transaction.

- [x] T023 [P] [US2] Create `src/app/api/projects/[id]/teams/route.ts`. Export an async `GET` function. Steps: (1) Session check — any authenticated user with project access. (2) Fetch all `TeamAssignment` records for the project: `prisma.teamAssignment.findMany({ where: { projectId: params.id, status: "active" }, include: { user: { select: { id: true, name: true, role: true, email: true } } } })`. (3) Fetch task counts per department: `prisma.task.groupBy({ by: ["assignedRole"], where: { projectId: params.id }, _count: { status: true } })`. Also fetch detailed task counts by status: for each department, count tasks with status `pending` (Hold), `in_progress`, and `done`. (4) Group the teamAssignments by `department`. For each department, separate team leaders (roles containing `team_leader_` or `leader_`) from agents. (5) Return `{ teams: [{ department, leader: { id, name, role }, agents: [{ id, name, role, status }], taskCounts: { hold, inProgress, done, total }, progressPercentage }] }`.

- [x] T024 [P] [US2] Create `src/app/api/projects/[id]/lifecycle/route.ts`. Export an async `PATCH` function. Steps: (1) Session check — roles allowed: `account_manager`, `head_account_manager`, `super_admin`. (2) If role is `account_manager`, verify `session.user.id === project.accountManagerId`. (3) Body: `{ lifecycleState: string }`. (4) Validate the transition using `validateLifecycleTransition(project.lifecycleState, newState)` from `src/lib/lifecycle.ts` — return 400 with the error message if invalid. (5) Also call `canChangeLifecycle(session.user.role, session.user.id, project.accountManagerId)` — return 403 if not allowed. (6) Update project: `prisma.project.update({ where: { id: params.id }, data: { lifecycleState: newState } })`. (7) Create ProjectLog with action `lifecycle_changed` and details `"Lifecycle changed from {old} to {new}"`. (8) Create Notifications for all users assigned to the project (Account Manager, Head Technical, Head SEO, all TeamAssignment users). (9) Trigger Pusher event `lifecycle-changed` on `private-project-${params.id}` with `{ lifecycleState: newState }`. (10) Return `{ success: true, project: { id, lifecycleState: newState } }`.

### Components for User Story 2

- [x] T025 [P] [US2] Create `src/components/TeamOverview.tsx`. This is a client component (`"use client"`). Props: `{ teams: Array<{ department: string; leader: { id: string; name: string; role: string } | null; agents: Array<{ id: string; name: string; role: string; status: string }>; taskCounts: { hold: number; inProgress: number; done: number; total: number }; progressPercentage: number }> }`. Render a grid of cards (one per department). Each card shows: (1) Department name as header (formatted — replace underscores with spaces, capitalize). (2) Team Leader name and role (or "Not Assigned" in gray if null). (3) Number of agents. (4) Task counts: show three small badges — `{hold} Hold`, `{inProgress} In Progress`, `{done} Done`. (5) A progress bar showing `progressPercentage` as `done/total * 100`. Use a grid layout: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.

### Dashboard Page for User Story 2

- [x] T026 [US2] Modify `src/app/dashboard/account-manager/page.tsx` (server component). Add data fetching for: (1) All projects assigned to this Account Manager: `prisma.project.findMany({ where: { accountManagerId: session.user.id }, include: { deal: { include: { lead: true } }, teamAssignments: { where: { status: "active" }, include: { user: { select: { id: true, name: true, role: true } } } }, tasks: { select: { id: true, status: true, taskType: true, assignedRole: true } }, notes: { orderBy: { createdAt: "desc" }, take: 5, include: { user: { select: { name: true, role: true } } } }, headTechnical: { select: { id: true, name: true } }, headSeo: { select: { id: true, name: true } }, warnings: { where: { receipts: { some: { userId: session.user.id, isRead: false } } } } }, orderBy: { updatedAt: "desc" } })`. (2) Head SEO users: `prisma.user.findMany({ where: { role: "head_seo" } })`. Pass all data to `AccountManagerClient`.

- [x] T027 [US2] Modify `src/app/dashboard/account-manager/AccountManagerClient.tsx` (client component). Add these sections: (1) **Assigned Clients List** — a table of all assigned projects with: client name, lifecycle badge (use `LifecycleStateBadge`), team count, open task count, last note date. Clickable rows to expand details. (2) **Client Detail Expanded View** — when a client row is clicked, show an expanded section with: (a) `TeamOverview` component showing all teams and task statuses, (b) Recent notes feed (last 5 notes with author, role, timestamp), (c) Lifecycle state change dropdown — show a `<select>` with allowed next states (fetch from `LIFECYCLE_TRANSITIONS[currentState]`). On change, call `fetch("/api/projects/{id}/lifecycle", { method: "PATCH", body: JSON.stringify({ lifecycleState }) })`. (d) "Distribute to SEO" button — if `headSeoId` is null, show the button. On click, open `DistributionPanel` with Head SEO users. The `onAssign` callback calls `fetch("/api/projects/{id}/assign-head-seo", { method: "POST", body: JSON.stringify({ headSeoId }) })`. (3) **Lifecycle filter** — dropdown at the top to filter clients by lifecycle state. Default to `Onboarding` and `Active`. (4) Add Pusher subscriptions: `private-user-${session.user.id}` for `project-assigned`, and for each project `private-project-${projectId}` for `task-status-changed`, `note-added`, `lifecycle-changed`. Import components: `LifecycleStateBadge`, `TeamOverview`, `DistributionPanel`.

**Checkpoint**: User Stories 1 AND 2 complete. The full Head Account Manager → Account Manager flow is functional.

---

## Phase 5: User Story 3 — Head Technical Distributes Work to Team Leaders (Priority: P1)

**Goal**: Head Technical receives client assignments from Head Account Manager, reviews scope, and distributes to Team Leader Social Media and Team Leader Media Buyer.

**Independent Test**: Assign a project to Head Technical via Prisma Studio or through US1 flow. Log in as Head Technical. Verify they see the client and can distribute to Team Leader Social Media and Team Leader Media Buyer.

### API Routes for User Story 3

- [x] T028 [P] [US3] Create `src/app/api/projects/[id]/distribute-team/route.ts`. Export an async `POST` function. Steps: (1) Session check — roles allowed: `head_technical`, `head_seo`, `super_admin`. (2) Body: `{ userId: string, department: string, role: string }`. (3) Validate using `canDistributeTo(session.user.role, body.role)` from `src/lib/distribution.ts` — return 403 if not allowed. (4) Verify the target user exists and has the specified role. (5) Create a TeamAssignment: `prisma.teamAssignment.create({ data: { projectId: params.id, userId: body.userId, assignedByUserId: session.user.id, role: body.role, department: body.department } })`. (6) Create ProjectLog with action `team_assigned` and details `"Team Leader assigned: {name} ({department})"`. (7) Create Notification for the target user with type `team_distributed`. (8) Trigger Pusher event `team-distributed` on `private-user-${body.userId}` with `{ projectId: params.id, department: body.department }`. (9) Return `{ success: true, assignment: { id, projectId, userId, department } }`. Handle the unique constraint error (user already assigned to project) — return 409 Conflict.

### Dashboard Page for User Story 3

- [x] T029 [US3] Modify `src/app/dashboard/head-technical/page.tsx` (server component). Add data fetching for: (1) Projects distributed to this Head Technical: `prisma.project.findMany({ where: { headTechnicalId: session.user.id }, include: { deal: true, accountManager: { select: { id: true, name: true } }, teamAssignments: { where: { status: "active" }, include: { user: { select: { id: true, name: true, role: true } } } }, tasks: { select: { id: true, status: true, taskType: true } } }, orderBy: { updatedAt: "desc" } })`. (2) Available Team Leaders for distribution: `prisma.user.findMany({ where: { role: { in: ["team_leader_social_media", "team_leader_media_buyer"] } }, include: { _count: { select: { teamAssignments: { where: { status: "active" } } } } } })`. Pass to `HeadTechnicalClient`.

- [x] T030 [US3] Modify `src/app/dashboard/head-technical/HeadTechnicalClient.tsx` (client component). Add these sections: (1) **Received Clients Queue** — list of projects distributed to this Head Technical. Each project shows: client name, Account Manager name, package type, lifecycle badge, distribution status. (2) **Distribution Status per Client** — for each project, show which Team Leaders have been assigned (check `teamAssignments` for roles `team_leader_social_media` and `team_leader_media_buyer`). Show a green checkmark if assigned, a yellow "Pending" badge if not. (3) **Distribute Buttons** — for each unassigned department, show a "Distribute to Social Media" or "Distribute to Media Buyer" button. On click, open `DistributionPanel` with the relevant Team Leader users (filtered by role). The `onAssign` callback calls `fetch("/api/projects/{id}/distribute-team", { method: "POST", body: JSON.stringify({ userId, department: "social_media", role: "team_leader_social_media" }) })` (adjust department/role for Media Buyer). (4) **Downstream Workload Overview** — show each Team Leader's current assignment count using `WorkloadIndicator`. Import components: `LifecycleStateBadge`, `DistributionPanel`, `WorkloadIndicator`. Add Pusher subscription to `private-user-${session.user.id}` for `project-assigned` events.

**Checkpoint**: User Story 3 complete. Full Head Account Manager → Head Technical → Team Leaders distribution chain works.

---

## Phase 6: User Story 4 — Team Leaders Distribute Work to Agents (Priority: P2)

**Goal**: Each Team Leader (Social Media, Media Buyer, SEO) distributes specific tasks to agents on their team. Team Leader SEO receives from Head SEO. All Team Leaders see workload per agent.

**Independent Test**: Distribute a project to a Team Leader via the US3 flow. Log in as that Team Leader. Verify they can create tasks and assign them to agents on their team.

### API Routes for User Story 4

- [x] T031 [P] [US4] Create `src/app/api/projects/[id]/assign-agent/route.ts`. Export an async `POST` function. Steps: (1) Session check — roles allowed: `team_leader_social_media`, `team_leader_media_buyer`, `team_leader_seo`, `leader_graphic_designer`, `leader_motion_graphic`, `leader_ui`, `super_admin`. (2) Body: `{ agentUserId: string, department: string }`. (3) Validate using `canDistributeTo(session.user.role, targetUserRole)` from `src/lib/distribution.ts`. (4) Verify the target user exists and has the correct agent role for the department. (5) Create a TeamAssignment: `prisma.teamAssignment.create({ data: { projectId: params.id, userId: body.agentUserId, assignedByUserId: session.user.id, role: targetUser.role, department: body.department } })`. (6) Create ProjectLog with action `team_assigned`. (7) Create Notification with type `task_assigned`. (8) Trigger Pusher event `team-distributed` on `private-user-${body.agentUserId}`. (9) Return `{ success: true, assignment: { id, projectId, userId } }`. Handle unique constraint error — return 409.

### Dashboard Updates for User Story 4

- [x] T032 [US4] Modify `src/app/dashboard/seo/page.tsx` (server component). Add data fetching for: (1) If user is `head_seo`: fetch projects distributed to them (`headSeoId: session.user.id`) with team assignments and tasks. Also fetch Team Leader SEO users for distribution. (2) If user is `team_leader_seo`: fetch projects where they have a TeamAssignment, plus available SEO agents. (3) If user is `agent_seo`: fetch projects where they have a TeamAssignment, plus their assigned tasks. Use `session.user.role` to determine which query to run. Pass role-appropriate data to `SeoClient`.

- [x] T033 [US4] Modify `src/app/dashboard/seo/SeoClient.tsx` (client component). Implement a role-aware dashboard: (1) **Head SEO view** (`role === "head_seo"`): Show received clients from Account Manager. For each client, show a "Distribute to Team Leader SEO" button. Use `DistributionPanel` with Team Leader SEO users. The `onAssign` callback calls `fetch("/api/projects/{id}/distribute-team", { method: "POST", body: JSON.stringify({ userId, department: "seo", role: "team_leader_seo" }) })`. Show distribution status per client. (2) **Team Leader SEO view** (`role === "team_leader_seo"`): Show received assignments. For each project, show assigned agents and their tasks. Show "Assign Agent" button — opens `DistributionPanel` with SEO agents. The `onAssign` callback calls `fetch("/api/projects/{id}/assign-agent", { method: "POST", body: JSON.stringify({ agentUserId, department: "seo" }) })`. Show task status board per agent. (3) **Agent SEO view** (`role === "agent_seo"`): Show assigned tasks. Each task shows client name, task details, status controls, and a "Create Cross-Team Task" button (implemented in US5). Import: `LifecycleStateBadge`, `DistributionPanel`, `WorkloadIndicator`, `TeamOverview`.

- [x] T034 [US4] Modify `src/app/dashboard/social-media/page.tsx` (server component). Similar to T032 but for Social Media roles. Fetch data for `team_leader_social_media` (projects with TeamAssignment, available Social Media agents) and `agent_social_media` (assigned tasks). Pass to `SocialMediaClient`.

- [x] T035 [US4] Modify `src/app/dashboard/social-media/SocialMediaClient.tsx` (client component). Implement role-aware dashboard: (1) **Team Leader view**: Show received assignments with project context. "Assign Agent" button → `DistributionPanel` with Social Media agents → calls `/api/projects/{id}/assign-agent`. Task status board per agent. (2) **Agent view**: Show assigned tasks with client context. Task status controls (dropdown: Hold, In Progress, Done). Status change calls `fetch("/api/tasks/{id}/status", { method: "PATCH", body: JSON.stringify({ status }) })`. "Create Cross-Team Task" button (implemented in US5). Import: `LifecycleStateBadge`, `DistributionPanel`, `WorkloadIndicator`.

- [x] T036 [US4] Create `src/app/dashboard/media-buyer/MediaBuyerClient.tsx` (client component — this file is NEW, currently only `page.tsx` exists). Implement role-aware dashboard identical in structure to `SocialMediaClient.tsx` but for Media Buyer roles: (1) **Team Leader Media Buyer view**: Show received assignments. "Assign Agent" button → `DistributionPanel` with Media Buyer agents → calls `/api/projects/{id}/assign-agent` with `department: "media_buyer"`. (2) **Agent Media Buyer view**: Show assigned tasks with client context. Task status controls. "Create Cross-Team Task" button (US5). Import: `LifecycleStateBadge`, `DistributionPanel`, `WorkloadIndicator`.

- [x] T037 [US4] Modify `src/app/dashboard/media-buyer/page.tsx` (server component). Add data fetching for Media Buyer roles (same pattern as T034). For `team_leader_media_buyer`: fetch projects with TeamAssignment + available Media Buyer agents. For `agent_media_buyer`: fetch assigned tasks. Import and render `MediaBuyerClient` with the fetched data.

**Checkpoint**: User Story 4 complete. Full distribution chain works: Head Account Manager → AM + Head Technical → Team Leaders → Agents.

---

## Phase 7: User Story 5 — Cross-Team Task Assignment System (Priority: P2)

**Goal**: Any operational agent can create a task request for creative teams (Graphic Design, Motion, UI/UX, Content SEO). Tasks auto-route to the correct Team Leader.

**Independent Test**: Log in as a Social Media Agent. Create a Graphic Design task. Verify it appears in the Graphic Design Team Leader's queue. Have the leader assign it to an agent. Verify status updates are visible to the requesting agent and Account Manager.

### API Routes for User Story 5

- [x] T038 [P] [US5] Modify `src/app/api/tasks/route.ts` — add cross-team routing logic to the existing POST handler. When a new task is created with `taskType` in `CROSS_TEAM_TASK_TYPES` (from `src/lib/constants.ts`): (1) Look up the leader role using `findTeamLeaderRoleForTaskType(taskType)` from `src/lib/distribution.ts`. (2) Find the user with that leader role: `prisma.user.findFirst({ where: { role: leaderRole } })`. (3) Set the task's `assignedUserId` to the leader, `assignedRole` to the leader role, `requesterRole` to `session.user.role`, `status` to `pending`. (4) Create ProjectLog with action `task_created` and details `"Cross-team task created: {taskType} for {projectName}"`. (5) Create Notification for the leader with type `task_assigned`. (6) Trigger Pusher event `task-assigned` on `private-user-${leaderId}` and `task-status-changed` on `private-project-${projectId}`. Preserve existing task creation logic for non-cross-team tasks.

### Components for User Story 5

- [x] T039 [P] [US5] Create `src/components/CrossTeamTaskForm.tsx`. This is a client component (`"use client"`). Props: `{ projectId: string; onClose: () => void; onSuccess: () => void }`. Render a modal form with: (1) **Task Type selector** — a `<select>` dropdown with options: `Graphic Design` (value: `graphic_design`), `Motion Graphic` (value: `motion_graphic`), `UI/UX` (value: `ui_design`), `Content SEO` (value: `content_seo`). (2) **Brief text area** — `<textarea>` for task requirements description. Required, min 10 characters. (3) **Deadline picker** — `<input type="date">`. Required, must be in the future. (4) **Priority selector** — `<select>` with options: `High`, `Medium`, `Low`. Default to `Medium`. (5) **Submit button** — on click, call `fetch("/api/tasks", { method: "POST", body: JSON.stringify({ projectId, taskType, brief, deadline, priority }) })`. Show loading state during submit. On success, call `onSuccess()` then `onClose()`. On error, show error message. (6) **Cancel button** — calls `onClose()`. Use a modal overlay (fixed position, backdrop blur, centered content). Style with Tailwind using the existing design patterns.

### Dashboard Updates for User Story 5

- [x] T040 [US5] Modify `src/app/dashboard/design/page.tsx` (server component). Add data fetching for: (1) Incoming cross-team tasks for this user's creative team. If user is a leader (`leader_graphic_designer`, `leader_motion_graphic`, `leader_ui`): `prisma.task.findMany({ where: { assignedUserId: session.user.id, taskType: { in: leaderTaskTypes } }, include: { project: { select: { id: true, name: true } }, requester: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "desc" } })`. Map leader roles to their task types: `leader_graphic_designer` → `graphic_design`, `leader_motion_graphic` → `motion_graphic`, `leader_ui` → `ui_design`. (2) If user is a creative agent: fetch tasks assigned to them. (3) Fetch available agents for the leader's team (for task assignment). Pass to `DesignClient`.

- [x] T041 [US5] Modify `src/app/dashboard/design/DesignClient.tsx` (client component). Add these sections: (1) **Incoming Task Queue** (leader view): List of tasks assigned to this leader. Each task shows: task type badge, client name, requesting agent name and role, brief (truncated), deadline, priority badge, status. Include an "Assign to Agent" button for each task — this calls `fetch("/api/tasks/{id}/assign", { method: "PATCH", body: JSON.stringify({ agentId }) })` after selecting an agent from a dropdown of available team agents. (2) **Active Tasks** (agent view): List of tasks assigned to this agent. Each task shows: task type, client name, brief, deadline, priority, status controls. Status controls: buttons or dropdown to change status to `in_progress` or `done`. Status change calls `fetch("/api/tasks/{id}/status", { method: "PATCH", body: JSON.stringify({ status, notes }) })`. (3) Add Pusher subscription to `private-user-${session.user.id}` for `task-assigned` events.

**Checkpoint**: User Story 5 complete. Cross-team task creation and routing works. Agents can create tasks, leaders can assign them, agents can complete them.

---

## Phase 8: User Story 6 — Universal Notes Visibility & Client Journey (Priority: P2)

**Goal**: Every authorized user can see all notes for a client regardless of which department created them. Notes are filterable by department, author, and date range.

**Independent Test**: Add notes from multiple roles (via Prisma Studio or API). Log in as any authorized user. Verify all notes are visible with full attribution and filtering works.

### API Updates for User Story 6

- [ ] T042 [P] [US6] Modify `src/app/api/notes/route.ts` — update the existing GET handler to support filtering. Add query parameter parsing: `department` (string, optional — filter by note category), `author` (string, optional — filter by `userId`), `from` (ISO date string, optional — filter `createdAt >= from`), `to` (ISO date string, optional — filter `createdAt <= to`), `page` (number, default 1), `limit` (number, default 50, max 50). Build the Prisma `where` clause dynamically: start with `{ projectId }`, then add `category: department` if department is provided, `userId: author` if author is provided, `createdAt: { gte: new Date(from), lte: new Date(to) }` if date range is provided. Include user data: `include: { user: { select: { id: true, name: true, role: true } } }`. Add pagination: `skip: (page - 1) * limit, take: limit`. Also return `total` count: `prisma.note.count({ where })`. Return `{ notes: [...], total, page, limit }`.

### Component Updates for User Story 6

- [ ] T043 [P] [US6] Modify `src/components/NotesPanel.tsx` — add filtering UI. Add to the existing component: (1) **Department filter** — a `<select>` dropdown with options: `All Departments`, `TeleSales`, `Sales`, `Account Manager`, `Technical`, `Design`, `SEO`, `Social Media`, `Media Buyer`, `Motion Graphic`, `UI Design`, `Content SEO`, `General`. Map display names to category values. On change, re-fetch notes with the selected department filter. (2) **Date range filter** — two `<input type="date">` fields: "From" and "To". On change, re-fetch notes with date range. (3) **Author filter** — optional text input to search by author name (client-side filtering is acceptable for this). (4) Update the note rendering to show: author name in bold, role badge (small colored tag), department label, timestamp in relative format (e.g., "2 hours ago"), and note content. (5) Add category-specific badge colors: `telesales` → purple, `sales` → blue, `account_manager` → green, `seo` → orange, `social_media` → pink, `media_buyer` → indigo, `design` → teal, `general` → gray. Fetch notes using the filters: `fetch("/api/notes?projectId={id}&department={dept}&from={from}&to={to}&page={page}&limit=50")`.

- [ ] T044 [P] [US6] Modify `src/components/ClientJourney.tsx` — expand timeline event types. Add support for these new event types in the timeline rendering: `team_assigned` (icon: Users, color: blue), `lifecycle_changed` (icon: RefreshCw, color: amber), `task_created` (icon: PlusCircle, color: green), `task_status_changed` (icon: CheckCircle, color: teal), `warning_issued` (icon: AlertTriangle, color: red), `note_added` (icon: MessageSquare, color: gray), `seo_distributed` (icon: Share2, color: orange), `technical_distributed` (icon: Share2, color: purple). For each event type, render the appropriate Lucide React icon (already available in the project) with the specified color. Each timeline entry should show: icon, event description (from `ProjectLog.details`), timestamp, and the user who performed the action.

**Checkpoint**: User Story 6 complete. Full notes visibility and enhanced client journey timeline.

---

## Phase 9: User Story 7 — Sales Data Loop (Bidirectional Visibility) (Priority: P2)

**Goal**: Sales Agents/Managers who closed the deal can see the full post-sale journey (teams, tasks, progress). READ-ONLY — no action buttons.

**Independent Test**: Close a deal (existing Sales flow). Have Operations teams begin work. Log in as the Sales Agent. Verify they can see the post-sale journey without any action buttons.

### Dashboard Update for User Story 7

- [ ] T045 [US7] Modify `src/app/dashboard/sales/page.tsx` (server component). Add a new data fetch for post-sale visibility. For each closed deal belonging to this Sales Agent or Sales Manager, fetch the associated project with operations data: `prisma.project.findMany({ where: { deal: { salesAgentId: session.user.id } }, include: { accountManager: { select: { id: true, name: true } }, headTechnical: { select: { id: true, name: true } }, headSeo: { select: { id: true, name: true } }, teamAssignments: { where: { status: "active" }, include: { user: { select: { id: true, name: true, role: true } } } }, tasks: { select: { id: true, taskType: true, status: true, createdAt: true, completedAt: true } }, _count: { select: { notes: true, warnings: true } } } })`. Pass this data alongside existing sales data to the Sales client component. If the client component doesn't accept this prop yet, add a `postSaleProjects` prop.

- [ ] T046 [US7] Add a **Post-Sale Journey** section to the Sales dashboard client component (locate the existing client component in `src/app/dashboard/sales/`). This section should be READ-ONLY (no buttons, no actions). Render: (1) A "Post-Sale Journey" tab or collapsible section. (2) For each project: client name, Account Manager name, lifecycle badge (`LifecycleStateBadge`), `TeamOverview` component (read-only), task summary (total tasks, completed, in-progress), note count, last activity date. (3) A "View Full Journey" link that opens a modal or navigates to a detail page calling `/api/projects/{id}/journey` and rendering the `ClientJourney` component. (4) No action buttons, no edit controls, no distribution panels. All data is display-only. Import: `LifecycleStateBadge`, `TeamOverview`, `ClientJourney`.

**Checkpoint**: User Story 7 complete. Sales can see what happens after they close a deal.

---

## Phase 10: User Story 8 — Warning / Complaint System (Priority: P3)

**Goal**: Account Managers and Sales Agents can issue warnings. Warnings trigger a BLOCKING popup for ALL involved users. Each user MUST acknowledge before continuing. Email fallback for offline users.

**Independent Test**: Issue a warning on a project. Verify that every involved user sees the blocking popup. Verify acknowledgment is recorded. Verify email is sent. Verify unread warnings persist across sessions.

### API Routes for User Story 8

- [ ] T047 [P] [US8] Modify `src/app/api/warnings/route.ts` — update the existing POST handler. After creating the warning, add: (1) Find all users involved with the project: Account Manager (`project.accountManagerId`), Head Account Manager (find user with role `head_account_manager`), Head Technical (`project.headTechnicalId`), Head SEO (`project.headSeoId`), all users from `TeamAssignment` where `projectId` matches and `status` is `active`. Collect all unique user IDs. (2) Create a `WarningReceipt` for each involved user: `prisma.warningReceipt.createMany({ data: affectedUserIds.map(userId => ({ warningId: warning.id, userId, isRead: false })) })`. (3) For each affected user, trigger Pusher event `warning-issued` on channel `private-user-${userId}` with `{ warningId: warning.id, severity: warning.severity }`. (4) For each affected user who has an email, call `sendWarningEmail(user.email, warning.subject, warning.message, senderName)` from `src/lib/email.ts`. Update each receipt: `prisma.warningReceipt.update({ where: { warningId_userId: { warningId, userId } }, data: { deliveredViaEmail: true, emailSentAt: new Date() } })`. Send emails in parallel with `Promise.allSettled()` — do NOT let email failures block the response. (5) Create ProjectLog with action `warning_issued`. (6) Return `{ success: true, warning: { id, receiptsCreated: affectedUserIds.length } }`. Use Prisma transaction for steps 1-2 and 5.

- [ ] T048 [P] [US8] Create `src/app/api/warnings/[id]/acknowledge/route.ts`. Export an async `POST` function. Steps: (1) Session check — any authenticated user. (2) Find the `WarningReceipt` for this warning and user: `prisma.warningReceipt.findUnique({ where: { warningId_userId: { warningId: params.id, userId: session.user.id } } })`. Return 404 if not found. Return 400 if already read (`isRead === true`). (3) Update the receipt: `prisma.warningReceipt.update({ where: { id: receipt.id }, data: { isRead: true, readAt: new Date() } })`. (4) Create ProjectLog with action `warning_read` and details `"Warning acknowledged by {userName}"`. (5) Return `{ success: true, receipt: { id, isRead: true, readAt } }`.

- [ ] T049 [P] [US8] Create `src/app/api/warnings/unread/route.ts`. Export an async `GET` function. Steps: (1) Session check — any authenticated user. (2) Fetch all unread warning receipts for this user: `prisma.warningReceipt.findMany({ where: { userId: session.user.id, isRead: false }, include: { warning: { include: { sender: { select: { id: true, name: true, role: true } } } } }, orderBy: { createdAt: "asc" } })`. (3) Map results to response format: `{ warnings: receipts.map(r => ({ id: r.warning.id, subject: r.warning.subject, message: r.warning.message, severity: r.warning.severity, senderName: r.warning.sender.name, senderRole: r.warning.sender.role, createdAt: r.warning.createdAt, receiptId: r.id })) }`. (4) Return the response.

- [ ] T050 [P] [US8] Create `src/app/api/warnings/log/route.ts`. Export an async `GET` function. Steps: (1) Session check — roles allowed: `head_account_manager`, `head_technical`, `super_admin`. (2) Parse optional query params: `projectId` (filter by project), `severity` (filter), `from`/`to` (date range). (3) Fetch warnings with receipts: `prisma.warning.findMany({ where: { ...(projectId && { projectId }), ...(severity && { severity }), ...(from && { createdAt: { gte: new Date(from) } }) }, include: { sender: { select: { id: true, name: true, role: true } }, receipts: { include: { user: { select: { id: true, name: true, role: true } } } }, project: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } })`. (4) Return `{ warnings: [...] }` with full receipt details.

### Component & Layout Updates for User Story 8

- [ ] T051 [US8] Modify `src/components/WarningPopup.tsx` — implement full blocking enforcement. Replace or enhance the existing component with: (1) Props: `{ warnings: Array<{ id: string; subject: string; message: string; severity: string; senderName: string; senderRole: string; createdAt: string; receiptId: string }>; onAcknowledge: (warningId: string) => void }`. (2) If `warnings` array is empty, render nothing (`return null`). (3) Render a FULL-SCREEN overlay: `fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center`. The `z-[9999]` ensures it's above everything. (4) Inside the overlay, render a card showing the FIRST warning (sequential display): severity badge (red for High, amber for Medium, blue for Low), subject as title, message as body, sender name and role, timestamp. (5) A single "Read Warning" button at the bottom — styled prominently (`bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold`). On click, call `onAcknowledge(warning.id)`. (6) NO close button, NO X icon, NO backdrop click dismiss. Add `onKeyDown` handler on the overlay div to prevent Escape key: `e.key === "Escape" && e.preventDefault()`. (7) Add `pointer-events: none` to the body while warnings are displayed (via useEffect that sets `document.body.style.overflow = "hidden"`). (8) Show a warning counter: "Warning 1 of {total}" if multiple warnings exist.

- [ ] T052 [US8] Modify `src/app/dashboard/layout.tsx` — integrate global warning enforcement. Add: (1) In the client-side wrapper of the layout, add a `useEffect` that fetches `/api/warnings/unread` on mount. Store the result in state: `const [unreadWarnings, setUnreadWarnings] = useState([])`. (2) Render `<WarningPopup warnings={unreadWarnings} onAcknowledge={handleAcknowledge} />` as the FIRST child inside the layout, BEFORE the sidebar and main content. (3) `handleAcknowledge` function: call `fetch("/api/warnings/{id}/acknowledge", { method: "POST" })`. On success, remove the acknowledged warning from the `unreadWarnings` state array. (4) Add Pusher subscription to `private-user-${session.user.id}` for `warning-issued` events. When received, re-fetch `/api/warnings/unread` to show the new warning. (5) Import `WarningPopup` from `@/components/WarningPopup`. Note: The layout may have a server component wrapper and a client component inner layout. The warning logic should go in the CLIENT component part. If the layout currently doesn't have a client component wrapper, create a `DashboardLayoutClient.tsx` that wraps the children and handles warnings + Pusher.

### Warnings Center Dashboard for User Story 8

- [ ] T053 [US8] Modify `src/app/dashboard/warnings/page.tsx` (server component). Add data fetching for the admin warning log: `prisma.warning.findMany({ include: { sender: { select: { id: true, name: true, role: true } }, project: { select: { id: true, name: true } }, receipts: { include: { user: { select: { id: true, name: true, role: true } } } } }, orderBy: { createdAt: "desc" } })`. Pass to `WarningsCenterClient`.

- [ ] T054 [US8] Modify `src/app/dashboard/warnings/WarningsCenterClient.tsx` (client component). Implement a full warning log dashboard: (1) **Warning list** — a table showing: severity badge, subject, project name, sender name, date, read/unread count (e.g., "8/12 read"). Each row is expandable. (2) **Expanded warning detail** — shows full message, and a list of ALL receipts: user name, role, read status (green checkmark if read with timestamp, red X if unread). (3) **Filters** — dropdowns for: project (select from available projects), severity (High/Medium/Low/All), date range. Filters re-fetch data from `/api/warnings/log?projectId=...&severity=...&from=...&to=...`. (4) **Create Warning button** — opens the existing `CreateWarningModal` component. Make sure the modal connects to the updated POST `/api/warnings` endpoint.

**Checkpoint**: User Story 8 complete. Full warning system with blocking enforcement, email fallback, and admin log.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that apply across all user stories — real-time integration, data loop verification, and cleanup.

- [ ] T055 [P] Verify Pusher integration across all dashboard client components — ensure each component subscribes to the appropriate channels (`private-user-{userId}` for personal events, `private-project-{projectId}` for project-level events) and auto-refreshes data when events are received. Check each client component: `HeadAccountManagerClient.tsx`, `AccountManagerClient.tsx`, `HeadTechnicalClient.tsx`, `SeoClient.tsx`, `SocialMediaClient.tsx`, `MediaBuyerClient.tsx`, `DesignClient.tsx`, `WarningsCenterClient.tsx`.

- [ ] T056 [P] Add the `CreateWarningModal` integration to all dashboard client components that should allow warning creation. Per the spec, Account Managers and Sales Agents can create warnings. Add a "Report Warning" button in `AccountManagerClient.tsx` for each client card. The button opens `CreateWarningModal` (or a new modal if it doesn't exist) that posts to `/api/warnings`.

- [ ] T057 [P] Review all new API routes for consistent error handling — every route must: (1) return proper HTTP status codes (400 for bad input, 401 for no auth, 403 for wrong role, 404 for not found, 409 for conflict, 500 for server error), (2) return JSON error responses in format `{ error: string, details?: string }`, (3) log errors to console using `console.error()` with the error message and stack trace.

- [ ] T058 [P] Run `npx prisma validate` to verify schema integrity, then run `npm run build` to verify TypeScript compilation succeeds with zero errors across all new and modified files.

- [ ] T059 Run the quickstart.md verification — follow the steps in `specs/001-erp-operations-system/quickstart.md` to verify: (1) All dashboard routes load correctly for each role. (2) The full distribution chain works end-to-end. (3) Warning popup appears and blocks correctly. (4) Sales can see post-sale data.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T002) — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2)
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) — can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) — can run in parallel with US1, US2
- **User Story 4 (Phase 6)**: Depends on US3 (`distribute-team` route from T028)
- **User Story 5 (Phase 7)**: Depends on Foundational (Phase 2) — can run in parallel with US1-US4
- **User Story 6 (Phase 8)**: Depends on Foundational (Phase 2) — can run in parallel with US1-US5
- **User Story 7 (Phase 9)**: Depends on US1 (needs assigned projects) and US6 (needs journey endpoint)
- **User Story 8 (Phase 10)**: Depends on Foundational (Phase 2) — can run after any story but must be the last tested
- **Polish (Phase 11)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Independent after Foundation
- **US2 (P1)**: Independent after Foundation (uses journey route from US1 but can be built independently)
- **US3 (P1)**: Independent after Foundation
- **US4 (P2)**: Depends on `distribute-team` route (T028 from US3)
- **US5 (P2)**: Independent after Foundation
- **US6 (P2)**: Independent after Foundation
- **US7 (P2)**: Requires journey endpoint (T016 from US1) and team data (T023 from US2)
- **US8 (P3)**: Independent after Foundation

### Within Each User Story

- API routes before dashboard pages (pages call the routes)
- Components before dashboard pages (pages import the components)
- Server component (`page.tsx`) before client component (`*Client.tsx`) (server passes data as props)

### Parallel Opportunities

**After Phase 2 (Foundational) completes**, the following can run in parallel:

```
Agent A: US1 (T014-T021) → US7 (T045-T046)
Agent B: US2 (T022-T027)
Agent C: US3 (T028-T030) → US4 (T031-T037)
Agent D: US5 (T038-T041)
Agent E: US6 (T042-T044)
Agent F: US8 (T047-T054)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T013) — **CRITICAL, blocks everything**
3. Complete Phase 3: User Story 1 (T014-T021)
4. **STOP and VALIDATE**: Test Head Account Manager distribution flow end-to-end
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Head Account Manager can distribute → Deploy/Demo (MVP!)
3. Add US2 → Account Manager has full visibility → Deploy/Demo
4. Add US3 → Head Technical can distribute → Deploy/Demo
5. Add US4 → All Team Leaders distribute to agents → Deploy/Demo
6. Add US5 → Cross-team tasks work → Deploy/Demo
7. Add US6 → Universal notes + journey → Deploy/Demo
8. Add US7 → Sales bidirectional visibility → Deploy/Demo
9. Add US8 → Warning system enforced → Deploy/Demo
10. Polish → Production ready

---

## Notes

- [P] tasks = different files, no dependencies — safe to run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- Follow existing patterns: Server Component (`page.tsx`) → Client Component (`*Client.tsx`)
- All API routes use: `getServerSession(authOptions)` → `hasRole()` → validate → Prisma query → JSON response
- All Pusher events use the existing server instance from `src/lib/pusher.ts`
- All new components use TailwindCSS classes matching the existing design system
