# Implementation Plan: ERP Operations System

**Branch**: `001-erp-operations-system` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-erp-operations-system/spec.md`

## Summary

Build the full post-sale operations layer for Thamaraa CRM: hierarchical client distribution from Head Account Manager through technical teams to individual agents, cross-team task routing for creative assets, universal notes visibility across all departments, a bidirectional data loop back to Sales, the 5-state client lifecycle, and a mandatory warning/complaint system with blocking acknowledgment popups and email fallback.

The implementation extends the existing Next.js 14 + Prisma + PostgreSQL + Pusher stack with 2 new database models (`TeamAssignment`, `WarningReceipt`), 1 new field on Project (`lifecycleState`), 11 new API routes, 5 new shared components, modifications to 7 existing dashboard pages, and a global warning enforcement mechanism in the dashboard layout.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 18+  
**Primary Dependencies**: Next.js 14.2, React 18, Prisma 5.22, NextAuth 4, Pusher, TailwindCSS 3.4, Lucide React, nodemailer (new)  
**Storage**: PostgreSQL via Prisma ORM (existing `DATABASE_URL`)  
**Testing**: Manual via browser + Prisma Studio for data verification  
**Target Platform**: Web (modern browsers: Chrome, Firefox, Edge, Safari)  
**Project Type**: Full-stack web application (Next.js App Router)  
**Performance Goals**: Dashboard loads < 3s, real-time updates < 5s, warning delivery < 15s  
**Constraints**: Must not modify TeleSales or Sales dashboards, must use existing auth/role system  
**Scale/Scope**: ~100 concurrent users, ~22 roles, ~12 dashboard views affected

## Constitution Check

*GATE: Constitution is a blank template — no project-specific gates configured. Proceeding with industry-standard best practices.*

- Role-based access control enforced at every API boundary ✅
- Existing patterns preserved (Server Component → Client Component) ✅
- No breaking changes to TeleSales/Sales modules ✅
- Real-time via existing Pusher infrastructure ✅

## Project Structure

### Documentation (this feature)

```text
specs/001-erp-operations-system/
├── spec.md              ✅ Complete
├── plan.md              ✅ This file
├── research.md          ✅ Complete
├── data-model.md        ✅ Complete
├── quickstart.md        ✅ Complete
├── contracts/
│   └── api-contracts.md ✅ Complete
├── checklists/
│   └── requirements.md  ✅ Complete
└── tasks.md             ⬜ Next (/speckit.tasks)
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                          # MODIFY: +TeamAssignment, +WarningReceipt, +Project.lifecycleState

src/
├── lib/
│   ├── constants.ts                       # MODIFY: +LIFECYCLE_STATE, +expanded TASK_TYPE, +role groups
│   ├── email.ts                           # NEW: SMTP email utility for warning emails
│   ├── distribution.ts                    # NEW: Distribution permission validation helpers
│   ├── lifecycle.ts                       # NEW: Lifecycle state transition validation
│   ├── pusher.ts                          # EXISTING (unchanged)
│   ├── prisma.ts                          # EXISTING (unchanged)
│   └── auth.ts                            # EXISTING (unchanged)
│
├── components/
│   ├── WarningPopup.tsx                   # MODIFY: Full blocking modal with Read Warning enforcement
│   ├── ClientJourney.tsx                  # MODIFY: Expanded timeline with all event types
│   ├── NotesPanel.tsx                     # MODIFY: Add department/date filters, expanded categories
│   ├── CreateWarningModal.tsx             # MODIFY: Connect to new WarningReceipt flow
│   ├── TaskAssignmentForm.tsx             # MODIFY: Cross-team task routing with auto leader detection
│   ├── TeamOverview.tsx                   # NEW: Team status panel showing all assigned teams + task counts
│   ├── LifecycleStateBadge.tsx            # NEW: Color-coded lifecycle state badge component
│   ├── CrossTeamTaskForm.tsx              # NEW: Form for creating cross-team creative tasks
│   ├── DistributionPanel.tsx              # NEW: Reusable panel for distributing work downstream
│   └── WorkloadIndicator.tsx              # NEW: Agent workload bar showing current task/client counts
│
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx                     # MODIFY: Add global WarningPopup + unread warning check
│   │   ├── head-account-manager/
│   │   │   ├── page.tsx                   # MODIFY: Add lifecycle filter, team overview data
│   │   │   └── HeadAccountManagerClient.tsx # MODIFY: Distribution UI, lifecycle badges, workload view
│   │   ├── account-manager/
│   │   │   ├── page.tsx                   # MODIFY: Include team assignments, task statuses
│   │   │   └── AccountManagerClient.tsx   # MODIFY: Team overview, SEO distribution, lifecycle control
│   │   ├── head-technical/
│   │   │   ├── page.tsx                   # MODIFY: Include distribution targets
│   │   │   └── HeadTechnicalClient.tsx    # MODIFY: Team Leader distribution UI
│   │   ├── seo/
│   │   │   ├── page.tsx                   # MODIFY: Include team assignment data
│   │   │   └── SeoClient.tsx             # MODIFY: Agent distribution, task visibility
│   │   ├── social-media/
│   │   │   ├── page.tsx                   # MODIFY: Include cross-team task data
│   │   │   └── SocialMediaClient.tsx      # MODIFY: Task creation, cross-team form
│   │   ├── media-buyer/
│   │   │   ├── page.tsx                   # MODIFY: Include cross-team task data
│   │   │   └── MediaBuyerClient.tsx       # NEW: Full media buyer dashboard (currently only page.tsx)
│   │   ├── design/
│   │   │   ├── page.tsx                   # MODIFY: Include incoming cross-team tasks
│   │   │   └── DesignClient.tsx           # MODIFY: Task queue, assignment, status controls
│   │   ├── sales/                         # READ-ONLY ADDITION: Post-sale visibility (no UI changes)
│   │   │   └── page.tsx                   # MODIFY: Add link to post-sale client journey view
│   │   ├── warnings/
│   │   │   ├── page.tsx                   # MODIFY: Admin warning log with receipt tracking
│   │   │   └── WarningsCenterClient.tsx   # MODIFY: Full warning log with read/unread status
│   │   └── telesales/                     # UNCHANGED
│   │
│   └── api/
│       ├── projects/
│       │   └── [id]/
│       │       ├── assign-account-manager/
│       │       │   └── route.ts           # NEW
│       │       ├── assign-head-technical/
│       │       │   └── route.ts           # NEW
│       │       ├── assign-head-seo/
│       │       │   └── route.ts           # NEW
│       │       ├── distribute-team/
│       │       │   └── route.ts           # NEW
│       │       ├── assign-agent/
│       │       │   └── route.ts           # NEW
│       │       ├── lifecycle/
│       │       │   └── route.ts           # NEW
│       │       ├── teams/
│       │       │   └── route.ts           # NEW
│       │       └── journey/
│       │           └── route.ts           # NEW
│       ├── notes/
│       │   └── route.ts                   # MODIFY: Add filtering by department, date range
│       ├── tasks/
│       │   └── route.ts                   # MODIFY: Cross-team routing logic
│       └── warnings/
│           ├── route.ts                   # MODIFY: Create WarningReceipts + send emails
│           ├── [id]/
│           │   └── acknowledge/
│           │       └── route.ts           # NEW
│           ├── unread/
│           │   └── route.ts              # NEW
│           └── log/
│               └── route.ts              # NEW
```

**Structure Decision**: Single Next.js project (no monorepo). All code lives under `src/` following the existing App Router pattern. New API routes are nested under existing resource directories. New components are flat in `src/components/`. This matches the existing structure exactly.

## Implementation Phases

### Phase 1: Database & Core Infrastructure (Foundation)

**Goal**: Schema changes, migration, and core utility functions.

1. **Schema modifications** (`prisma/schema.prisma`):
   - Add `lifecycleState` field to `Project` model
   - Create `TeamAssignment` model with relations
   - Create `WarningReceipt` model with relations
   - Add new relations to `User` model
   - Run `prisma migrate dev`

2. **Constants update** (`src/lib/constants.ts`):
   - Add `LIFECYCLE_STATE` enum object
   - Add `LIFECYCLE_TRANSITIONS` allowed transitions map
   - Add `MEDIA_BUYER_ROLES` group constant
   - Expand `TASK_TYPE` if needed

3. **Core utilities** (new files):
   - `src/lib/lifecycle.ts` — `validateLifecycleTransition()`, `canChangeLifecycle()`
   - `src/lib/distribution.ts` — `canDistributeTo()`, `getDistributionTargets()`, `findTeamLeaderForTaskType()`
   - `src/lib/email.ts` — `sendWarningEmail()` with SMTP config

### Phase 2: API Routes (Backend Logic)

**Goal**: All API endpoints operational and tested via Prisma Studio / REST client.

1. **Project distribution routes**:
   - `assign-account-manager` — Head Account Manager → Account Manager
   - `assign-head-technical` — Head Account Manager → Head Technical
   - `assign-head-seo` — Account Manager → Head SEO
   - `distribute-team` — Head Technical/Head SEO → Team Leaders
   - `assign-agent` — Team Leaders → Agents
   - All create `ProjectLog` + `Notification` + Pusher events

2. **Lifecycle route**:
   - `PATCH /api/projects/[id]/lifecycle` — state transition with validation

3. **Team visibility route**:
   - `GET /api/projects/[id]/teams` — aggregated team + agent view

4. **Journey route**:
   - `GET /api/projects/[id]/journey` — full chronological timeline (Lead → CallLogs → Meetings → Deal → Project → TeamAssignments → Tasks → Notes → Warnings)

5. **Warning routes**:
   - `POST /api/warnings` — create warning + WarningReceipts + Pusher + email
   - `POST /api/warnings/[id]/acknowledge` — mark receipt as read
   - `GET /api/warnings/unread` — get current user's unread warnings
   - `GET /api/warnings/log` — admin view with read/unread status

6. **Notes route modifications**:
   - Add `department`, `author`, `from`, `to` query filters to existing `GET /api/notes`

7. **Tasks route modifications**:
   - Add cross-team routing logic (auto-detect leader by task type)

### Phase 3: Shared Components (UI Building Blocks)

**Goal**: Reusable components that all dashboards will use.

1. **`LifecycleStateBadge.tsx`** — color-coded badge:
   - Onboarding → blue
   - Active → green
   - On Hold → amber
   - Completed → gray
   - Churned → red

2. **`TeamOverview.tsx`** — panel showing all teams on a project:
   - Department name, Team Leader, Agents
   - Task counts per team (Hold / In Progress / Done)
   - Overall progress percentage

3. **`CrossTeamTaskForm.tsx`** — modal form:
   - Task type selector (Graphic Design, Motion, UI/UX, Content SEO)
   - Brief text area, deadline picker, priority selector
   - Auto-routes to correct Team Leader

4. **`DistributionPanel.tsx`** — reusable distribution UI:
   - List of available users for the distribution target role
   - Workload indicator per user
   - Assign button with confirmation

5. **`WorkloadIndicator.tsx`** — visual bar:
   - Shows active task count / active client count
   - Color gradient: green (light) → amber (moderate) → red (heavy)

6. **Modify `WarningPopup.tsx`** — full blocking enforcement:
   - Fetches `/api/warnings/unread` on mount
   - Full-screen overlay, no close button, no escape key
   - "Read Warning" button → calls `/api/warnings/[id]/acknowledge`
   - Sequential display for multiple warnings
   - Integrated into `dashboard/layout.tsx` (global)

7. **Modify `ClientJourney.tsx`** — expanded timeline:
   - Add event types: team_assigned, lifecycle_changed, task_created, task_status_changed, warning_issued
   - Color-coded event icons per type

8. **Modify `NotesPanel.tsx`** — department/date filters:
   - Dropdown filter by department (all departments)
   - Date range picker
   - Expanded category badge colors

### Phase 4: Dashboard Pages (Role-Specific UIs)

**Goal**: Each role's dashboard is fully functional with all specified features.

1. **Head Account Manager Dashboard** — `head-account-manager/`:
   - Incoming client queue (projects with `lifecycleState: Onboarding` and no `accountManagerId`)
   - Distribution panel: assign to Account Manager Agent + Head Technical
   - Client list with lifecycle state badges and filters
   - Account Manager workload overview cards
   - Reassignment capability

2. **Account Manager Dashboard** — `account-manager/`:
   - Assigned clients list with lifecycle state badges
   - Per-client team overview panel (Social Media, Media Buyer, SEO teams + task statuses)
   - SEO distribution button (distribute to Head SEO)
   - Lifecycle state change controls (Onboarding → Active → On Hold → Completed → Churned)
   - Full notes feed with cross-department visibility
   - Warning creation button

3. **Head Technical Dashboard** — `head-technical/`:
   - Received client queue
   - Distribution to Team Leader Social Media + Team Leader Media Buyer
   - Distribution status per client (who has been distributed to, who hasn't)
   - Downstream team workload overview

4. **SEO Dashboard** — `seo/`:
   - Head SEO: received clients + distribute to Team Leader SEO
   - Team Leader SEO: received assignments + distribute to SEO Agents
   - Agent SEO: assigned tasks + cross-team task creation (Content SEO)

5. **Social Media Dashboard** — `social-media/`:
   - Team Leader: received assignments + distribute to Social Media Agents
   - Agent: assigned tasks + cross-team task creation (Graphic Design, Motion)

6. **Media Buyer Dashboard** — `media-buyer/`:
   - Create `MediaBuyerClient.tsx` (currently only has `page.tsx`)
   - Team Leader: received assignments + distribute to Media Buyer Agents
   - Agent: assigned tasks + cross-team task creation (Graphic Design)

7. **Design Dashboard** — `design/`:
   - Incoming cross-team task queue (Graphic Design, Motion, UI from other teams)
   - Leader view: assign incoming tasks to agents
   - Agent view: task details, status controls, deliverable notes

8. **Sales Dashboard** (read-only addition) — `sales/`:
   - Add "Post-Sale Journey" tab/section for closed deals
   - Shows: Account Manager assignment, team overview, task progress, current lifecycle state
   - Read-only — no action buttons

9. **Warnings Center** — `warnings/`:
   - Admin log with full receipt tracking (who read, who hasn't, timestamps)
   - Filterable by project, severity, date

### Phase 5: Global Warning Enforcement & Integration

**Goal**: Warning popup works globally, real-time events connected, data loop closed.

1. **Dashboard layout integration** (`dashboard/layout.tsx`):
   - Add `useEffect` to fetch `/api/warnings/unread` on mount
   - Render `WarningPopup` as first child (above all content)
   - Subscribe to Pusher `private-user-{userId}` for `warning-issued` events
   - Re-fetch unread warnings when Pusher event received

2. **Pusher integration across all dashboards**:
   - Subscribe to `private-project-{projectId}` for real-time task/note updates
   - Auto-refresh relevant data when events received

3. **Sales data loop verification**:
   - Verify Sales can see post-sale journey via `/api/projects/[id]/journey`
   - Verify task statuses and team progress are visible

4. **End-to-end flow testing**:
   - Full flow: Deal closes → HAM assigns → AM distributes → Teams work → Tasks complete
   - Warning flow: Complaint → Popup for all → Read acknowledgment
   - Lifecycle flow: Onboarding → Active → On Hold → Active → Completed

## Complexity Tracking

> No constitution violations to justify — constitution is a blank template.

| Decision | Rationale | Alternative Rejected Because |
|----------|-----------|------------------------------|
| `WarningReceipt` join table instead of JSON | Enables reliable query "who hasn't read" + enforces read-before-use | JSON string (`acknowledgedBy`) cannot be indexed or queried efficiently |
| Keep `projectStatus` alongside new `lifecycleState` | Different concerns: operational workflow vs client-facing state | Merging would break existing TeleSales/Sales workflows |
| `nodemailer` for email instead of external service | Warning-only emails don't justify a paid service integration | SendGrid/Resend are overkill for ~5 emails/week |
