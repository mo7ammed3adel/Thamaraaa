# Tasks: Operations & Task Distribution System

**Input**: Design documents from `/specs/002-operations-task-distribution/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not requested in the feature specification — test tasks are excluded.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Schema Migration)

**Purpose**: Extend the Prisma schema with new columns required by clarified features

- [x] T001 Add `flagReason` (String?), `flaggedAt` (DateTime?), `flaggedByUserId` (String?) columns to Task model in `prisma/schema.prisma`
- [x] T002 Add `resolvedAt` (DateTime?), `resolvedByUserId` (String?) columns to Warning model in `prisma/schema.prisma`
- [x] T003 Run `npx prisma migrate dev --name add-task-flag-warning-resolve` to apply schema migration
- [x] T004 Verify existing functionality is unaffected by running `npm run build`

---

## Phase 2: Foundational (Shared Helpers & Components)

**Purpose**: Add distribution helpers and create shared UI components that multiple user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Add `canFlagTask(userRole: string, taskAgentId: string, currentUserId: string): boolean` helper to `src/lib/distribution.ts` — returns true only if the user is the assigned agent
- [x] T006 Add `canReassignTask(userRole: string): boolean` helper to `src/lib/distribution.ts` — returns true only for Team Leader roles present in `TEAM_LEADER_ROLES`
- [x] T007 Add `canResolveWarning(userId: string, warningSenderUserId: string): boolean` helper to `src/lib/distribution.ts` — returns true only if userId matches senderUserId
- [x] T008 [P] Create `TaskFlagModal` component in `src/components/TaskFlagModal.tsx` — modal with textarea for reason input, submit calls POST `/api/tasks/[id]/flag`, shows success/error feedback
- [x] T009 [P] Create `TaskReassignModal` component in `src/components/TaskReassignModal.tsx` — modal with dropdown of team agents filtered by `DISTRIBUTION_MAP[leaderRole]`, submit calls POST `/api/tasks/[id]/reassign`
- [x] T010 [P] Create `WarningResolveButton` component in `src/components/WarningResolveButton.tsx` — button visible only to warning sender, confirms before POST `/api/warnings/[id]/resolve`, toggles to "Resolved" badge on success
- [x] T011 [P] Create `ClientReassignModal` component in `src/components/ClientReassignModal.tsx` — modal with dropdown of all `account_manager` role users, submit calls POST `/api/projects/[id]/reassign-am`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Head Account Manager Receives and Distributes Clients (Priority: P1) 🎯 MVP

**Goal**: Head Account Manager sees new clients after deal closure, views full journey, assigns to Account Manager Agents / Head Technical / Head SEO

**Independent Test**: Close a deal in Sales → verify client appears in Head AM dashboard with full journey → assign to an Account Manager Agent → verify it appears in their dashboard

### Implementation for User Story 1

- [x] T012 [US1] Verify Head Account Manager dashboard (`src/app/dashboard/head-account-manager/HeadAccountManagerClient.tsx`) correctly lists new projects from closed deals — confirm client name, entry date, contact info, and package are displayed
- [x] T013 [US1] Verify client detail view in Head AM dashboard shows full chronological client journey — TeleSales notes, Sales notes, call logs, meeting records via `ClientJourney` component
- [x] T014 [US1] Verify `DistributeModal` in Head AM dashboard shows only valid targets: Account Manager Agents, Head Technical, Head SEO — per `DISTRIBUTION_MAP.head_account_manager`
- [x] T015 [US1] Verify that after assignment, the client appears in the target user's dashboard with full journey data preserved
- [x] T016 [US1] Add workload count display (current assignment count) next to each assignee name in `DistributeModal` using `TeamWorkloadBadge` component — per FR-022

**Checkpoint**: User Story 1 — complete and independently testable

---

## Phase 4: User Story 2 — Account Manager Agent Manages Client and Monitors Progress (Priority: P1)

**Goal**: Account Manager Agent sees assigned clients, writes notes, views team composition and task statuses, manages client lifecycle state

**Independent Test**: Assign a client to an AM Agent → verify they see full journey, can write notes, see team members, see task statuses, and can manage lifecycle (Active/On Hold/Completed)

### Implementation for User Story 2

- [x] T017 [US2] Verify Account Manager dashboard (`src/app/dashboard/account-manager/AccountManagerClient.tsx`) lists all assigned clients with correct lifecycle state badges
- [x] T018 [US2] Verify client detail view shows all notes from every employee chronologically via `NotesPanel` and `ClientJourney` components
- [x] T019 [US2] Verify Account Manager can write notes on a client and the note persists with correct category (`account_manager`) and is visible to other users
- [x] T020 [US2] Verify `TeamOverview` component shows all assigned team members (Social Media, Media Buyer, SEO, Design) with roles and names for each project
- [x] T021 [US2] Verify task list displays all tasks across departments with status, creator, creation date, and completion date
- [x] T022 [US2] Verify `LifecycleChangeModal` allows Account Manager Agent to transition client between Active ↔ On Hold ↔ Completed states — per FR-023, FR-024, FR-025
- [x] T023 [US2] Integrate `WarningResolveButton` into the warnings section of Account Manager dashboard — visible only on warnings where the current user is the sender — per FR-029, FR-031

**Checkpoint**: User Story 2 — complete and independently testable

---

## Phase 5: User Story 3 — Hierarchical Task Distribution Through Team Leaders (Priority: P1)

**Goal**: Head Technical → Team Leaders → Agents distribution chain works end-to-end with full journey visibility at each level

**Independent Test**: Trace client from Head AM → Head Technical → TL Social Media → Agent Social Media — verify journey visible at every level

### Implementation for User Story 3

- [x] T024 [US3] Verify Head Technical dashboard (`src/app/dashboard/head-technical/HeadTechnicalClient.tsx`) lists clients assigned by Head AM with full journey data
- [x] T025 [US3] Verify Head Technical `DistributeModal` shows only Team Leader Social Media and Team Leader Media Buyer as targets — per `DISTRIBUTION_MAP.head_technical`
- [x] T026 [US3] Verify SEO dashboard correctly routes Head SEO assignments to Team Leader SEO only — per `DISTRIBUTION_MAP.head_seo`
- [x] T027 [US3] Verify Team Leader dashboards (SEO, Social Media, Media Buyer) list assigned clients with full journey data and can assign to their agents
- [x] T028 [US3] Verify agents (SEO, Social Media, Media Buyer) see assigned clients with full journey from all previous stages
- [x] T029 [US3] Add `TaskReassignModal` integration into all Team Leader dashboards: `src/app/dashboard/seo/SeoClient.tsx`, `src/app/dashboard/social-media/`, `src/app/dashboard/media-buyer/` — per FR-026
- [x] T030 [US3] Add `TaskFlagModal` integration into all Agent views (SEO Agent, Social Media Agent, Media Buyer Agent) in their respective dashboard files — per FR-027

**Checkpoint**: User Story 3 — complete and independently testable

---

## Phase 6: User Story 4 — Cross-Department Task Creation by Agents (Priority: P2)

**Goal**: Operational agents (Social Media, Media Buyer, SEO, Content SEO) can create tasks targeting design Team Leaders (Graphic, Motion, UI/UX)

**Independent Test**: Log in as Social Media Agent → create design task with link → verify it appears in Leader Graphic Designer dashboard

### Implementation for User Story 4

- [x] T031 [US4] Verify `CrossTeamTaskForm` in Social Media Agent dashboard allows selecting target departments: Graphic Design, Motion Graphic, UI/UX — per `CROSS_TEAM_TASK_TYPES` mapping
- [x] T032 [US4] Verify `CrossTeamTaskForm` in Media Buyer Agent dashboard allows all three design targets (Graphic Design, Motion Graphic, UI/UX)
- [x] T033 [US4] Verify `CrossTeamTaskForm` in SEO Agent and Content SEO Agent dashboards allows only Graphic Design and UI/UX (NOT Motion Graphic) — per acceptance scenario 4
- [x] T034 [US4] Verify task created via `CrossTeamTaskForm` appears in the correct Team Leader's dashboard (`src/app/dashboard/design/`) with task link, work type, creation date, and originating agent info
- [x] T035 [US4] Verify Team Leader in design dashboard can assign the received task to one of their agents using `TaskAssignmentForm`
- [x] T036 [US4] Verify notification is sent to the originating agent when their cross-department task is reassigned or flagged — per FR-028

**Checkpoint**: User Story 4 — complete and independently testable

---

## Phase 7: User Story 5 — Task Status Management by Design and Production Agents (Priority: P2)

**Goal**: Design agents receive tasks, view client journey, update status through hold → in progress → done

**Independent Test**: Assign task to Graphic Designer Agent → verify they see task details → update status → verify change reflected on Team Leader and Account Manager dashboards

### Implementation for User Story 5

- [x] T037 [US5] Verify Graphic Designer Agent dashboard shows assigned tasks with link, work type, creation date, and client info
- [x] T038 [US5] Verify design agents can open client page and see full journey notes from TeleSales, Sales, Account Manager, and all team members
- [x] T039 [US5] Verify task status updates (pending → in_progress → review → done) by design agents are reflected in real-time on Team Leader dashboards via Pusher
- [x] T040 [US5] Verify completed task (status = done) shows completion date on Account Manager's client view
- [x] T041 [US5] Add `TaskFlagModal` integration into design agent views (`src/app/dashboard/design/`) for Graphic Designer, Motion Graphic, and UI/UX agents — per FR-027
- [x] T042 [US5] Add `TaskReassignModal` integration into design Team Leader views (Leader Graphic Designer, Leader Motion Graphic, Leader UI/UX) in `src/app/dashboard/design/` — per FR-026

**Checkpoint**: User Story 5 — complete and independently testable

---

## Phase 8: User Story 6 — Mandatory Blocking Warning System (Priority: P2)

**Goal**: Account Manager or Sales agents can create blocking Warnings that must be acknowledged by all connected employees

**Independent Test**: Send Warning as Account Manager Agent → verify blocking popup on all connected dashboards → acknowledge → verify popup dismisses → resolve Warning

### Implementation for User Story 6

- [x] T043 [US6] Verify `CreateWarningModal` allows Account Manager Agents and Sales agents to write and send Warnings on a client — per `WARNING_ISSUER_ROLES`
- [x] T044 [US6] Verify `WarningPopup` blocking overlay appears on all connected employees' dashboards via Pusher `user-{userId}` channel
- [x] T045 [US6] Verify `WarningPopup` blocks all system interaction (clicks, navigation) until "Mark as Read" is clicked — per FR-019
- [x] T046 [US6] Verify `GlobalWarningAlert` component checks for unread warnings on page load and shows pending popups for employees who were offline — per FR-021
- [x] T047 [US6] Verify warning acknowledgment is logged in `WarningReceipt` table with userId, readAt timestamp — per FR-020
- [x] T048 [US6] Verify warning sender can see read/unread status of all recipients
- [x] T049 [US6] Create POST `/api/warnings/[id]/resolve` endpoint in `src/app/api/warnings/[id]/resolve/route.ts` — validates sender identity, updates status to "Resolved", sets resolvedAt and resolvedByUserId — per FR-029, FR-031
- [x] T050 [US6] Verify open (unresolved) Warnings remain visible in client file and are visually distinct from resolved Warnings — per FR-030

**Checkpoint**: User Story 6 — complete and independently testable

---

## Phase 9: User Story 7 — Client Journey Visibility Across All Roles (Priority: P3)

**Goal**: Every employee with client access sees the complete chronological journey from TeleSales through current operations

**Independent Test**: Log in as Graphic Designer Agent with a task → open client page → verify TeleSales, Sales, Account Manager, and all team notes are visible chronologically

### Implementation for User Story 7

- [x] T051 [US7] Verify `ClientJourney` component (`src/components/ClientJourney.tsx`) displays notes from all categories (telesales, sales, account_manager, technical, design, seo, social_media, media_buyer, motion_graphic, ui_design, content_seo, general) in chronological order
- [x] T052 [US7] Verify `ClientJourney` component displays call logs from TeleSales stage with call status, classification, and notes
- [x] T053 [US7] Verify `ClientJourney` component displays meeting records from Sales stage with meeting date, status, summary, and deal amount
- [x] T054 [US7] Verify new notes written by any employee appear in real-time for other users viewing the same client — via Pusher or page refresh

**Checkpoint**: User Story 7 — complete and independently testable

---

## Phase 10: Client Reassignment (Clarification Feature)

**Goal**: Head Account Manager can reassign clients between Account Manager Agents with full data preservation

**Independent Test**: Log in as Head AM → reassign client from AM-A to AM-B → verify all history, tasks, notes, and warnings transfer seamlessly

### Implementation

- [x] T055 Create POST `/api/projects/[id]/reassign-am/route.ts` endpoint in `src/app/api/projects/[id]/reassign-am/` — validates Head AM or super_admin role, validates new user is account_manager role, updates accountManagerId, creates ProjectLog entry, sends Pusher event and notifications — per FR-032, FR-033, FR-034
- [x] T056 Integrate `ClientReassignModal` into Head Account Manager dashboard (`src/app/dashboard/head-account-manager/HeadAccountManagerClient.tsx`) — add "Reassign AM" button on client detail that opens the modal
- [x] T057 Verify all client history (notes, tasks, team assignments, warnings) remains intact after reassignment — confirm new AM sees identical client file

**Checkpoint**: Client reassignment — complete and independently testable

---

## Phase 11: Task Flag & Reassign API (Clarification Feature)

**Goal**: Agents can flag/return tasks, Team Leaders can reassign within their team

**Independent Test**: Flag a task as an agent → verify it returns to TL queue → TL reassigns to different agent → verify new agent receives it

### Implementation

- [x] T058 Create POST `/api/tasks/[id]/flag/route.ts` endpoint in `src/app/api/tasks/[id]/flag/` — validates agent ownership, requires non-empty reason, sets flagReason/flaggedAt/flaggedByUserId, nulls agentId, reverts status to pending, sends Pusher event and notifications — per FR-027
- [x] T059 Create POST `/api/tasks/[id]/reassign/route.ts` endpoint in `src/app/api/tasks/[id]/reassign/` — validates Team Leader role, validates new agent is in the TL's distribution targets, updates agentId, sends Pusher event and notifications — per FR-026
- [x] T060 Verify flagged task appears in Team Leader's unassigned queue with the flag reason displayed
- [x] T061 Verify originating agent (task creator) receives a notification when their task is flagged or reassigned — per FR-028

**Checkpoint**: Task flag & reassign — complete and independently testable

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, build check, and documentation

- [x] T062 [P] Run `npm run build` and verify zero TypeScript errors and zero build warnings
- [x] T063 [P] Verify Pusher real-time events fire correctly for all new features (task flag, task reassign, warning resolve, client reassign)
- [x] T064 Verify permission enforcement: wrong roles receive 403 on all 4 new API endpoints
- [x] T065 Verify `checkProjectBlockers` in `src/lib/distribution.ts` correctly uses `WarningReceipt` table (not deprecated `acknowledgedBy` JSON) for blocking logic
- [x] T066 Run full end-to-end flow: Close deal → Head AM assigns → AM manages → tasks created → design agents work → warnings sent and resolved → client reassigned → verify all data integrity
- [x] T067 [P] Update quickstart.md with final verification results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (schema migration) — BLOCKS all user stories
- **Phases 3-9 (User Stories)**: All depend on Phase 2 completion
  - US1 (P1): No story dependencies → can start first
  - US2 (P1): Loosely depends on US1 (client assignment flow), but can be verified independently
  - US3 (P1): Loosely depends on US1 (distribution chain), but can be verified independently
  - US4 (P2): Depends on US3 (Team Leaders receiving clients to create tasks for)
  - US5 (P2): Depends on US4 (tasks must exist to manage status)
  - US6 (P2): Independent — can start after Phase 2
  - US7 (P3): Independent — can start after Phase 2
- **Phases 10-11 (Clarification Features)**: Depend on Phase 2 only
- **Phase 12 (Polish)**: Depends on all previous phases

### Parallel Opportunities

- T008, T009, T010, T011 (all new components) can run in parallel
- US1, US6, US7 can all start simultaneously after Phase 2
- Phase 10 and Phase 11 can run in parallel with any user story phase
- T062, T063, T067 can run in parallel in the Polish phase

---

## Parallel Example: Phase 2 Components

```bash
# Launch all new component tasks together:
Task: "Create TaskFlagModal in src/components/TaskFlagModal.tsx"
Task: "Create TaskReassignModal in src/components/TaskReassignModal.tsx"
Task: "Create WarningResolveButton in src/components/WarningResolveButton.tsx"
Task: "Create ClientReassignModal in src/components/ClientReassignModal.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Schema Migration
2. Complete Phase 2: Foundational Helpers & Components
3. Complete Phase 3: User Story 1 (Head AM Distribution)
4. **STOP and VALIDATE**: Test Head AM flow independently
5. Deploy/demo if ready

### Incremental Delivery

1. Schema + Foundational → Foundation ready
2. Add US1 → Test → Deploy (MVP!)
3. Add US2 + US3 → Test → Deploy (Core operations)
4. Add US4 + US5 → Test → Deploy (Cross-department tasks)
5. Add US6 → Test → Deploy (Warning system enhancements)
6. Add US7 → Test → Deploy (Journey visibility)
7. Phase 10 + 11 → Test → Deploy (Clarification features)
8. Polish → Final deploy

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Most tasks in Phases 3-9 are **verification tasks** since the codebase already has the implementation — focus on confirming behavior matches spec
- Phases 10-11 contain the **net-new code** (4 new API routes) from the clarification session
