# Research: Operations & Task Distribution System

**Branch**: `002-operations-task-distribution` | **Date**: 2026-04-23

## Existing Infrastructure Assessment

### Decision: Leverage existing codebase extensively
**Rationale**: The codebase already has ~80% of the required infrastructure:
- Prisma schema has `Project`, `Task`, `Warning`, `Note`, `TeamAssignment`, `WarningReceipt` models
- `DISTRIBUTION_MAP` in `src/lib/distribution.ts` already defines hierarchical routing
- `constants.ts` has all 24 roles, lifecycle states, task types, distribution permissions
- Pusher real-time layer is operational
- Dashboard pages exist for most roles (head-account-manager, account-manager, seo, social-media, media-buyer, design, head-technical)
- Shared components exist: `ClientJourney`, `WarningPopup`, `GlobalWarningAlert`, `CreateWarningModal`, `CrossTeamTaskForm`, `DistributeModal`, `NotesPanel`, `TeamOverview`, `TaskAssignmentForm`

**Alternatives considered**: Starting fresh with a new module structure — rejected because the existing code matches the spec patterns closely.

## Gap Analysis

### 1. Schema Gaps

**Decision**: Extend existing Prisma models, do NOT create new models.
**Rationale**: The existing models align with spec entities. Only minor columns/features are missing.

| Model | Status | Missing |
|-------|--------|---------|
| `Project` | ✅ Exists | Already has `lifecycleState` with transitions |
| `Task` | ✅ Exists | Missing: `flagReason`, `flaggedAt`, `flaggedByUserId` for task return/flag feature |
| `Warning` | ✅ Exists | Already has `status` (Active/Resolved/Archived) and `resolvedAt` is needed; `resolvedByUserId` needed |
| `WarningReceipt` | ✅ Exists | Fully functional |
| `Note` | ✅ Exists | Fully functional with categories |
| `TeamAssignment` | ✅ Exists | Fully functional |
| `User` | ✅ Exists | No changes needed |

### 2. API Route Gaps

**Decision**: Add new API endpoints only for missing features.
**Rationale**: Most CRUD operations exist. Only task flagging, warning resolution, and client reassignment need new endpoints.

| Route | Status | Action |
|-------|--------|--------|
| `/api/projects` | ✅ Exists | No changes |
| `/api/tasks` | ✅ Exists | Add: flag/return endpoint, reassign endpoint |
| `/api/warnings` | ✅ Exists | Add: resolve endpoint |
| `/api/team-assignments` | ✅ Exists | No changes |
| `/api/notes` | ✅ Exists | No changes |
| `/api/projects/[id]/reassign` | ❌ Missing | New: client reassignment between Account Managers |

### 3. Dashboard Page Gaps

**Decision**: Update existing pages rather than rebuilding.
**Rationale**: All role dashboards exist. They need incremental enhancements.

| Dashboard | Status | Missing Features |
|-----------|--------|-----------------|
| Head Account Manager | ✅ Exists | Client reassignment between AMs |
| Account Manager | ✅ Exists | Warning resolution button, task flag notifications |
| Head Technical | ✅ Exists | Minor enhancements |
| Head SEO | Partial | Verify distribution to TL SEO only |
| Team Leader SEO | ✅ Exists (via seo/) | Task reassignment within team |
| Agent SEO | ✅ Exists (via seo/) | Task flag/return button |
| Team Leader Social Media | ✅ Exists (via social-media/) | Task reassignment within team |
| Agent Social Media | ✅ Exists (via social-media/) | Task flag/return button |
| Team Leader Media Buyer | ✅ Exists (via media-buyer/) | Task reassignment within team |
| Agent Media Buyer | ✅ Exists (via media-buyer/) | Task flag/return button |
| Leader Graphic Designer | ✅ Exists (via design/) | Task reassignment within team |
| Agent Graphic Designer | ✅ Exists (via design/) | Task flag/return button |
| Leader Motion Graphic | ✅ Exists (via design/) | Task reassignment within team |
| Agent Motion Graphic | ✅ Exists (via design/) | Task flag/return button |
| Leader UI/UX | ✅ Exists (via design/) | Task reassignment within team |
| Agent UI/UX | ✅ Exists (via design/) | Task flag/return button |

### 4. Component Gaps

| Component | Status | Missing |
|-----------|--------|---------|
| `ClientJourney` | ✅ Exists | No changes |
| `WarningPopup` | ✅ Exists | No changes |
| `GlobalWarningAlert` | ✅ Exists | No changes |
| `CreateWarningModal` | ✅ Exists | No changes |
| `CrossTeamTaskForm` | ✅ Exists | No changes |
| `NotesPanel` | ✅ Exists | No changes |
| `TeamOverview` | ✅ Exists | No changes |
| `TaskAssignmentForm` | ✅ Exists | No changes |
| `WarningResolveButton` | ❌ Missing | New: allows creator to resolve warning |
| `TaskFlagModal` | ❌ Missing | New: agents return tasks with reason |
| `TaskReassignModal` | ❌ Missing | New: Team Leaders reassign within team |
| `ClientReassignModal` | ❌ Missing | New: Head AM reassigns between AMs |

## Technology Decisions

### Real-time Delivery (Warnings, Task Updates)
**Decision**: Continue using Pusher (already configured)
**Rationale**: Pusher server/client already integrated. Warning delivery via Pusher channels is the established pattern.
**Alternatives considered**: WebSockets (manual) — rejected, too much infrastructure overhead for existing system.

### Database Migrations
**Decision**: Prisma migrate for schema changes
**Rationale**: Project already uses Prisma migrations. Adding columns to Task and Warning is a standard migration.

### Warning Blocking Enforcement
**Decision**: Client-side blocking via GlobalWarningAlert component (already exists)
**Rationale**: The component already renders a full-screen overlay. Server-side enforcement via middleware can be added as a defense-in-depth measure.
