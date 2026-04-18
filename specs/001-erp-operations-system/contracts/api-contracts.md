# API Contracts: ERP Operations System

**Branch**: `001-erp-operations-system` | **Date**: 2026-04-17

All endpoints follow the existing pattern: `src/app/api/{resource}/route.ts` with NextAuth session + role validation at the boundary.

---

## 1. Project Distribution Endpoints

### POST `/api/projects/[id]/assign-account-manager`
**Roles**: `head_account_manager`, `super_admin`

**Request:**
```json
{
  "accountManagerId": "uuid"
}
```

**Response 200:**
```json
{
  "success": true,
  "project": { "id": "...", "accountManagerId": "...", "lifecycleState": "Onboarding" }
}
```

**Side effects:** Creates ProjectLog entry, sends in-app Notification to Account Manager, triggers Pusher event `project-assigned` on `private-user-{accountManagerId}`.

---

### POST `/api/projects/[id]/assign-head-technical`
**Roles**: `head_account_manager`, `super_admin`

**Request:**
```json
{
  "headTechnicalId": "uuid"
}
```

**Response 200:**
```json
{
  "success": true,
  "project": { "id": "...", "headTechnicalId": "..." }
}
```

**Side effects:** Creates ProjectLog entry, sends Notification, triggers Pusher event.

---

### POST `/api/projects/[id]/assign-head-seo`
**Roles**: `account_manager`, `head_account_manager`, `super_admin`

**Request:**
```json
{
  "headSeoId": "uuid"
}
```

**Response 200:**
```json
{
  "success": true,
  "project": { "id": "...", "headSeoId": "..." }
}
```

---

### POST `/api/projects/[id]/distribute-team`
**Roles**: `head_technical`, `head_seo`, `super_admin`

**Request:**
```json
{
  "userId": "uuid",
  "department": "social_media | media_buyer | seo",
  "role": "team_leader_social_media | team_leader_media_buyer | team_leader_seo"
}
```

**Response 200:**
```json
{
  "success": true,
  "assignment": { "id": "...", "projectId": "...", "userId": "...", "department": "..." }
}
```

**Validation:**
- `head_technical` can ONLY distribute to `team_leader_social_media` and `team_leader_media_buyer`
- `head_seo` can ONLY distribute to `team_leader_seo`

---

### POST `/api/projects/[id]/assign-agent`
**Roles**: `team_leader_social_media`, `team_leader_media_buyer`, `team_leader_seo`, `leader_graphic_designer`, `leader_motion_graphic`, `leader_ui`, `super_admin`

**Request:**
```json
{
  "agentUserId": "uuid",
  "department": "social_media | media_buyer | seo | graphic_design | motion_graphic | ui_design"
}
```

**Response 200:**
```json
{
  "success": true,
  "assignment": { "id": "...", "projectId": "...", "userId": "..." }
}
```

**Validation:** Team Leader can only assign agents from their own department.

---

### PATCH `/api/projects/[id]/lifecycle`
**Roles**: `account_manager` (assigned only), `head_account_manager`, `super_admin`

**Request:**
```json
{
  "lifecycleState": "Onboarding | Active | On_Hold | Completed | Churned"
}
```

**Response 200:**
```json
{
  "success": true,
  "project": { "id": "...", "lifecycleState": "Active" }
}
```

**Validation:**
- Account Manager must be the assigned `accountManagerId`
- State transition must follow allowed transitions (see data-model.md)

**Side effects:** Creates ProjectLog with `lifecycle_changed` action, notifies all assigned users.

---

## 2. Team Assignment Endpoints

### GET `/api/projects/[id]/teams`
**Roles**: Any user with project access

**Response 200:**
```json
{
  "teams": [
    {
      "id": "uuid",
      "department": "social_media",
      "user": { "id": "...", "name": "...", "role": "team_leader_social_media" },
      "status": "active",
      "assignedAt": "2026-04-17T...",
      "agents": [
        {
          "id": "uuid",
          "user": { "id": "...", "name": "...", "role": "agent_social_media" },
          "status": "active"
        }
      ]
    }
  ]
}
```

---

## 3. Task Endpoints (Cross-Team)

### POST `/api/tasks`
**Roles**: Any operational agent with project access

**Request:**
```json
{
  "projectId": "uuid",
  "taskType": "graphic_design | motion_graphic | ui_design | content_seo",
  "brief": "Design social media post template for Ramadan campaign",
  "deadline": "2026-04-25T00:00:00Z",
  "priority": "High | Medium | Low",
  "parentTaskId": "uuid (optional — links to the requesting agent's own task)"
}
```

**Response 201:**
```json
{
  "success": true,
  "task": { "id": "...", "taskType": "graphic_design", "status": "pending", "leaderId": "..." }
}
```

**Routing logic:** System automatically finds the Team Leader for the given `taskType`:
- `graphic_design` → user with role `leader_graphic_designer`
- `motion_graphic` → user with role `leader_motion_graphic`
- `ui_design` → user with role `leader_ui`
- `content_seo` → user with role `team_leader_seo` or `agent_content_seo` leader

---

### PATCH `/api/tasks/[id]/status`
**Roles**: Assigned leader or agent for the task

**Request:**
```json
{
  "status": "pending | in_progress | review | done",
  "notes": "Completed 3 variants for client review"
}
```

**Response 200:**
```json
{
  "success": true,
  "task": { "id": "...", "status": "done", "completedAt": "2026-04-17T..." }
}
```

**Side effects:** 
- Creates ProjectLog with `task_status_changed`
- Notifies requesting agent when status changes to `done`
- Pusher event on `private-project-{projectId}`

---

### PATCH `/api/tasks/[id]/assign`
**Roles**: Task leader only

**Request:**
```json
{
  "agentId": "uuid"
}
```

---

## 4. Notes Endpoints

### GET `/api/notes?projectId={id}&department={filter}&author={filter}&from={date}&to={date}`
**Roles**: Any user with project access

**Response 200:**
```json
{
  "notes": [
    {
      "id": "uuid",
      "content": "Client prefers blue color scheme...",
      "userName": "Ahmed",
      "userRole": "account_manager",
      "category": "account_manager",
      "createdAt": "2026-04-17T..."
    }
  ],
  "total": 42
}
```

Supports pagination: `?page=1&limit=50`

---

### POST `/api/notes`
**Roles**: Any user with project access

**Request:**
```json
{
  "projectId": "uuid",
  "content": "Client requested 3 variants for the logo",
  "category": "auto-detected from user role"
}
```

**Side effects:** Creates ProjectLog with `note_added`, Pusher event on `private-project-{projectId}`.

---

## 5. Warning Endpoints

### POST `/api/warnings`
**Roles**: `account_manager`, `sales_agent`, `sales_manager`, `head_account_manager`, `super_admin`

**Request:**
```json
{
  "projectId": "uuid",
  "subject": "Client Complaint - Delayed Delivery",
  "message": "Client called to complain about delayed social media posts...",
  "severity": "High"
}
```

**Response 201:**
```json
{
  "success": true,
  "warning": { "id": "...", "receiptsCreated": 12 }
}
```

**Side effects:**
1. Creates `WarningReceipt` for every user with active `TeamAssignment` on the project + Account Manager + Head Account Manager + Head Technical
2. Sends Pusher event `warning-issued` to each affected user's private channel
3. Sends email to each affected user via SMTP
4. Creates ProjectLog with `warning_issued`

---

### POST `/api/warnings/[id]/acknowledge`
**Roles**: Any user with a WarningReceipt for this warning

**Request:** (empty body — authenticated user is the acknowledger)

**Response 200:**
```json
{
  "success": true,
  "receipt": { "id": "...", "isRead": true, "readAt": "2026-04-17T..." }
}
```

---

### GET `/api/warnings/unread`
**Roles**: Authenticated user (self)

**Response 200:**
```json
{
  "warnings": [
    {
      "id": "uuid",
      "subject": "Client Complaint",
      "message": "...",
      "severity": "High",
      "senderName": "Ahmed",
      "senderRole": "account_manager",
      "createdAt": "2026-04-17T...",
      "receiptId": "uuid"
    }
  ]
}
```

Called on every page load (via layout) to enforce blocking popup.

---

### GET `/api/warnings/log?projectId={id}`
**Roles**: `head_account_manager`, `head_technical`, `super_admin`

**Response 200:**
```json
{
  "warnings": [
    {
      "id": "uuid",
      "subject": "...",
      "message": "...",
      "severity": "High",
      "senderName": "...",
      "createdAt": "...",
      "receipts": [
        { "userName": "...", "userRole": "...", "isRead": true, "readAt": "..." },
        { "userName": "...", "userRole": "...", "isRead": false, "readAt": null }
      ]
    }
  ]
}
```

---

## 6. Dashboard Data Endpoints

### GET `/api/projects/dashboard/head-account-manager`
**Roles**: `head_account_manager`, `super_admin`

**Response:** Projects grouped by state with workload per Account Manager.

### GET `/api/projects/dashboard/account-manager`
**Roles**: `account_manager`, `super_admin`

**Response:** Assigned projects with team overview, task counts, lifecycle states.

### GET `/api/projects/dashboard/head-technical`
**Roles**: `head_technical`, `super_admin`

**Response:** Received projects with distribution status per Team Leader.

### GET `/api/projects/dashboard/team-leader?department={dept}`
**Roles**: `team_leader_*`, `super_admin`

**Response:** Assigned projects/tasks with agent workload.

### GET `/api/projects/dashboard/agent?department={dept}`
**Roles**: `agent_*`, `super_admin`

**Response:** Assigned tasks with full client context.

### GET `/api/projects/[id]/journey`
**Roles**: Any user with project access

**Response:** Complete client journey timeline — lead data, call logs, meetings, deal, assignments, tasks, notes, warnings — in chronological order.

---

## 7. Pusher Event Contracts

| Event | Channel | Payload |
|-------|---------|---------|
| `project-assigned` | `private-user-{userId}` | `{ projectId, action }` |
| `team-distributed` | `private-user-{userId}` | `{ projectId, department }` |
| `task-assigned` | `private-user-{userId}` | `{ taskId, projectId }` |
| `task-status-changed` | `private-project-{projectId}` | `{ taskId, status }` |
| `note-added` | `private-project-{projectId}` | `{ noteId }` |
| `warning-issued` | `private-user-{userId}` | `{ warningId, severity }` |
| `lifecycle-changed` | `private-project-{projectId}` | `{ lifecycleState }` |
