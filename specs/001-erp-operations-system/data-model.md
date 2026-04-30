# Data Model: ERP Operations System

**Branch**: `001-erp-operations-system` | **Date**: 2026-04-17

## Overview

This document defines schema changes ONLY — additions and modifications to the existing Prisma schema. Existing models that are not listed here remain unchanged.

---

## Schema Changes

### MODIFY: `Project` Model

Add the 5-state lifecycle and consolidate `finalStatus` + `projectStatus` into a single `lifecycleState` field.

**New fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `lifecycleState` | `String` | `"Onboarding"` | 5-state lifecycle: Onboarding, Active, On_Hold, Completed, Churned |

**Deprecation:**
- `finalStatus` → replaced by `lifecycleState`. Keep field for backwards compatibility during migration but stop writing to it.
- `projectStatus` → keep for granular workflow tracking (new, setup, assigned, in_progress, completed, on_hold, delayed, cancelled). This is the internal operational status, while `lifecycleState` is the client-facing state.

**Relationship:**
- `lifecycleState` is the client's overall state visible on all dashboards
- `projectStatus` is the internal operational tracking for the Account Manager

---

### NEW: `TeamAssignment` Model

Tracks which Team Leaders and Agents are assigned to work on a specific project. This is the missing link that enables "see all teams working on the client."

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `projectId` | `String` | FK → Project | The project being worked on |
| `userId` | `String` | FK → User | The assigned team leader or agent |
| `assignedByUserId` | `String` | FK → User | Who made the assignment |
| `role` | `String` | Required | Role of the assigned user at time of assignment |
| `department` | `String` | Required | Department: social_media, media_buyer, seo, graphic_design, motion_graphic, ui_design, content_seo |
| `status` | `String` | Default: `"active"` | active, paused, completed, removed |
| `assignedAt` | `DateTime` | `@default(now())` | When the assignment was made |
| `removedAt` | `DateTime?` | Nullable | When the user was removed from the project |

**Unique constraint:** `@@unique([projectId, userId])` — a user can only be assigned to a project once.

**Relations:**
- `project` → `Project` (many-to-one)
- `user` → `User` (many-to-one)
- `assignedByUser` → `User` (many-to-one)

---

### NEW: `WarningReceipt` Model

Replaces the JSON `acknowledgedBy` field on `Warning` with a proper relational model for reliable querying and enforcement.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `warningId` | `String` | FK → Warning | The warning being acknowledged |
| `userId` | `String` | FK → User | The user who must read this warning |
| `isRead` | `Boolean` | Default: `false` | Whether the user has read the warning |
| `readAt` | `DateTime?` | Nullable | When the user acknowledged the warning |
| `deliveredViaEmail` | `Boolean` | Default: `false` | Whether email notification was sent |
| `emailSentAt` | `DateTime?` | Nullable | When the email was sent |
| `createdAt` | `DateTime` | `@default(now())` | When the receipt was created |

**Unique constraint:** `@@unique([warningId, userId])` — one receipt per user per warning.

**Relations:**
- `warning` → `Warning` (many-to-one, cascade delete)
- `user` → `User` (many-to-one)

---

### MODIFY: `Warning` Model

**Changes:**
- Remove `acknowledgedBy` field (replaced by `WarningReceipt` model)
- Add `projectId` relation to `Project` model (currently just a loose `String?`)
- Add `receipts` relation to `WarningReceipt[]`

**Updated relations:**

| Relation | Type | Description |
|----------|------|-------------|
| `project` | `Project?` | FK → Project (optional, for project-scoped warnings) |
| `receipts` | `WarningReceipt[]` | All receipt records for this warning |

---

### MODIFY: `ProjectLog` Model

**Expand `action` enum values** to cover full lifecycle tracking:

Current values: `assigned, deadline_changed, status_changed, progress_updated`

**New values to add:**
- `lifecycle_changed` — when `lifecycleState` changes
- `team_assigned` — when a TeamAssignment is created
- `team_removed` — when a TeamAssignment is removed
- `task_created` — when a cross-team task is created
- `task_status_changed` — when a task status changes
- `warning_issued` — when a warning is created
- `warning_read` — when a user acknowledges a warning
- `note_added` — when a note is added
- `seo_distributed` — when Account Manager distributes to Head SEO
- `technical_distributed` — when Head Account Manager distributes to Head Technical

---

### MODIFY: `Note` Model

**Expand `category` enum values:**

Current values: `telesales, sales, account_manager, technical, design, general`

**New values to add:**
- `seo` — notes from SEO team
- `social_media` — notes from Social Media team
- `media_buyer` — notes from Media Buyer team
- `motion_graphic` — notes from Motion Graphic team
- `ui_design` — notes from UI team
- `content_seo` — notes from Content SEO team

---

### MODIFY: `User` Model

**Add new relations:**

| Relation | Type | Description |
|----------|------|-------------|
| `teamAssignments` | `TeamAssignment[]` | Projects this user is assigned to |
| `teamAssignmentsMade` | `TeamAssignment[]` | Assignments this user created |
| `warningReceipts` | `WarningReceipt[]` | Warning receipts for this user |

---

### MODIFY: `Notification` Model

**Expand `type` enum values:**

Current values: `lead_assigned, meeting_update, deal_closed, etc.`

**New values to add:**
- `project_assigned` — project assigned to Account Manager
- `team_distributed` — work distributed to team leader
- `task_assigned` — task assigned to agent
- `task_completed` — task marked as done
- `task_status_changed` — task status updated
- `warning_issued` — warning created (in-app)
- `lifecycle_changed` — client lifecycle state changed
- `note_added` — new note added to a project

---

## State Machines

### Client/Project Lifecycle State Machine

```
                ┌──────────────┐
                │  Onboarding  │ ← Entry (from Sales deal close)
                └──────┬───────┘
                       │ All teams assigned
                       ▼
                ┌──────────────┐
           ┌───▶│    Active     │◀──┐
           │    └──────┬───────┘   │
           │           │           │
           │    ┌──────▼───────┐   │
           │    │   On Hold    │───┘ Resume
           │    └──────┬───────┘
           │           │
           │    ┌──────▼───────┐
           └────│  Completed   │ (normal end)
                └──────────────┘

                ┌──────────────┐
  Any state ───▶│   Churned    │ (client left)
                └──────────────┘
```

**Allowed transitions:**
- Onboarding → Active (all teams assigned, work begins)
- Active → On Hold (client request, payment issue, internal)
- On Hold → Active (resume work)
- Active → Completed (all deliverables done, contract ended)
- On Hold → Completed (contract ended while paused)
- Any → Churned (client left or did not renew)

**Transition permissions:** Account Manager Agent (assigned) OR Head Account Manager only.

### Task Status State Machine

```
Hold ──▶ In Progress ──▶ Done
  ▲          │
  └──────────┘ (back to hold if blocked)
```

Existing model already supports: `pending → in_progress → review → done`

---

## Entity Relationship Summary

```
Deal (existing)
 └── Project (existing, + lifecycleState)
      ├── TeamAssignment[] (NEW)
      │    └── User
      ├── Task[] (existing, + parentTask for cross-team)
      │    └── User (leader + agent)
      ├── Note[] (existing, + expanded categories)
      ├── ProjectLog[] (existing, + expanded actions)
      ├── ProjectFile[] (existing)
      └── Warning[] (existing, modified)
           └── WarningReceipt[] (NEW)
                └── User

Lead (existing, unchanged)
 └── CallLog[] (existing, unchanged)
 └── Meeting[] (existing, unchanged)
```
