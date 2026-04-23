# API Contracts: Operations & Task Distribution System

**Branch**: `002-operations-task-distribution` | **Date**: 2026-04-23

All endpoints follow the existing Next.js API route pattern: `src/app/api/[resource]/route.ts`

## New Endpoints

### 1. POST `/api/tasks/[id]/flag`

Flag/return a task from an agent back to their Team Leader.

**Request**:
```json
{
  "reason": "string (required, non-empty)"
}
```

**Response 200**:
```json
{
  "success": true,
  "task": {
    "id": "string",
    "status": "pending",
    "agentId": null,
    "flagReason": "string",
    "flaggedAt": "ISO 8601",
    "flaggedByUserId": "string"
  }
}
```

**Errors**:
- `403`: User is not the assigned agent for this task
- `400`: Missing or empty reason
- `400`: Task is already done or not assigned

**Side effects**:
- Pusher event `task-flagged` on channel `project-{projectId}`
- Notification created for the Task's `leaderId` (Team Leader)
- Notification created for the task creator (`requesterRole` user)

---

### 2. POST `/api/tasks/[id]/reassign`

Team Leader reassigns a task to a different agent within their team.

**Request**:
```json
{
  "newAgentId": "string (required, UUID)"
}
```

**Response 200**:
```json
{
  "success": true,
  "task": {
    "id": "string",
    "agentId": "string (new agent)",
    "status": "pending"
  }
}
```

**Errors**:
- `403`: User is not the Team Leader for this task
- `400`: New agent is not in the Team Leader's team (role mismatch)
- `404`: Task not found

**Side effects**:
- Pusher event `task-reassigned` on channel `project-{projectId}`
- Notification to old agent (if any) and new agent

---

### 3. POST `/api/warnings/[id]/resolve`

Warning creator marks a Warning as Resolved.

**Request**:
```json
{}
```
(No body needed — resolver is derived from session.)

**Response 200**:
```json
{
  "success": true,
  "warning": {
    "id": "string",
    "status": "Resolved",
    "resolvedAt": "ISO 8601",
    "resolvedByUserId": "string"
  }
}
```

**Errors**:
- `403`: User is not the Warning creator (`senderUserId`)
- `400`: Warning is already Resolved or Archived
- `404`: Warning not found

**Side effects**:
- Pusher event `warning-resolved` on channel `project-{projectId}`

---

### 4. POST `/api/projects/[id]/reassign-am`

Head Account Manager reassigns a project from one Account Manager Agent to another.

**Request**:
```json
{
  "newAccountManagerId": "string (required, UUID)"
}
```

**Response 200**:
```json
{
  "success": true,
  "project": {
    "id": "string",
    "accountManagerId": "string (new AM)",
    "previousAccountManagerId": "string (old AM)"
  }
}
```

**Errors**:
- `403`: User is not `head_account_manager` or `super_admin`
- `400`: New user is not an `account_manager` role
- `400`: New AM is the same as current AM
- `404`: Project not found

**Side effects**:
- `ProjectLog` entry created with action `reassigned` and details including old/new AM
- Pusher event `project-reassigned` on channel `project-{projectId}`
- Notification to old AM and new AM

## Existing Endpoints (No Changes Needed)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects` | GET/POST | List and create projects |
| `/api/projects/[id]` | GET/PATCH | Get and update project |
| `/api/tasks` | GET/POST | List and create tasks |
| `/api/tasks/[id]` | PATCH | Update task status |
| `/api/warnings` | GET/POST | List and create warnings |
| `/api/warnings/[id]/acknowledge` | POST | Mark warning as read |
| `/api/team-assignments` | GET/POST | List and create assignments |
| `/api/notes` | GET/POST | List and create notes |

## Pusher Channel Conventions (Existing Pattern)

| Channel | Events |
|---------|--------|
| `project-{projectId}` | `task-flagged`, `task-reassigned`, `warning-resolved`, `project-reassigned` |
| `user-{userId}` | `warning-alert` (blocking popup trigger) |
| `global` | `notification` |
