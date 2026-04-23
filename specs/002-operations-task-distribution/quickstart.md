# Quickstart: Operations & Task Distribution System

**Branch**: `002-operations-task-distribution` | **Date**: 2026-04-23

## Prerequisites

- Node.js 18+
- PostgreSQL database (connection string in `.env`)
- Pusher account (keys in `.env`)

## Setup

```bash
# 1. Switch to feature branch
git checkout 002-operations-task-distribution

# 2. Install dependencies (no new packages needed)
npm install

# 3. Run Prisma migration (after schema changes)
npx prisma migrate dev --name add-task-flag-warning-resolve

# 4. Generate Prisma client
npx prisma generate

# 5. Start dev server
npm run dev
```

## Environment Variables (existing .env)

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
PUSHER_APP_ID="..."
PUSHER_SECRET="..."
NEXT_PUBLIC_PUSHER_KEY="..."
NEXT_PUBLIC_PUSHER_CLUSTER="eu"
```

No new environment variables are required for this feature.

## Schema Changes Summary

Only **5 new columns** across 2 existing models:

### Task model (+3 columns)
```prisma
flagReason      String?   // Reason for flagging/returning
flaggedAt       DateTime? // When the task was flagged
flaggedByUserId String?   // Who flagged it
```

### Warning model (+2 columns)
```prisma
resolvedAt       DateTime? // When resolved
resolvedByUserId String?   // Who resolved (must be sender)
```

## New API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/tasks/[id]/flag` | Agent flags/returns task to Team Leader |
| POST | `/api/tasks/[id]/reassign` | Team Leader reassigns task within team |
| POST | `/api/warnings/[id]/resolve` | Warning creator marks as Resolved |
| POST | `/api/projects/[id]/reassign-am` | Head AM reassigns client between AMs |

## New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `TaskFlagModal` | `src/components/TaskFlagModal.tsx` | Agent enters reason and flags task |
| `TaskReassignModal` | `src/components/TaskReassignModal.tsx` | Team Leader picks new agent |
| `WarningResolveButton` | `src/components/WarningResolveButton.tsx` | Warning creator resolves |
| `ClientReassignModal` | `src/components/ClientReassignModal.tsx` | Head AM picks new AM |

## Testing the Feature

### 1. Task Flag Flow
1. Log in as any design agent (e.g., `agent_graphic_designer`)
2. Open an assigned task
3. Click "Flag/Return" → enter reason → submit
4. Verify task disappears from agent's queue
5. Log in as the Team Leader → verify task appears in unassigned queue with flag reason

### 2. Task Reassignment
1. Log in as a Team Leader (e.g., `leader_graphic_designer`)
2. Open a flagged or unassigned task
3. Click "Reassign" → select a different agent → confirm
4. Verify the task appears in the new agent's dashboard

### 3. Warning Resolution
1. Log in as Account Manager Agent
2. Create a Warning on a client
3. Verify popup appears for all connected employees
4. After employees acknowledge, click "Resolve" on the Warning
5. Verify Warning status changes to "Resolved"

### 4. Client Reassignment
1. Log in as Head Account Manager
2. Open a client's detail page
3. Click "Reassign AM" → select a different Account Manager Agent
4. Verify the client now appears in the new AM's dashboard
5. Verify all history, tasks, and notes are preserved

## File Structure (new/modified files only)

```
prisma/
  schema.prisma                          # +5 columns

src/app/api/
  tasks/[id]/flag/route.ts               # NEW
  tasks/[id]/reassign/route.ts           # NEW
  warnings/[id]/resolve/route.ts         # NEW
  projects/[id]/reassign-am/route.ts     # NEW

src/components/
  TaskFlagModal.tsx                       # NEW
  TaskReassignModal.tsx                   # NEW
  WarningResolveButton.tsx                # NEW
  ClientReassignModal.tsx                 # NEW

src/app/dashboard/
  head-account-manager/
    HeadAccountManagerClient.tsx          # MODIFIED (add reassign button)
  account-manager/
    AccountManagerClient.tsx              # MODIFIED (add resolve button)
  seo/SeoClient.tsx                      # MODIFIED (add flag + reassign)
  social-media/                          # MODIFIED (add flag + reassign)
  media-buyer/                           # MODIFIED (add flag + reassign)
  design/                                # MODIFIED (add flag + reassign)
```
