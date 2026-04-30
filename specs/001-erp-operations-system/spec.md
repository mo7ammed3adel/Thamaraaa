# Feature Specification: ERP Operations System — Account Management, Technical Teams, Task Routing & Warning System

**Feature Branch**: `001-erp-operations-system`  
**Created**: 2026-04-17  
**Status**: Draft  
**Input**: User description: "Full ERP operations layer — Account Manager workspace, technical team distribution, cross-team task system, full-journey notes visibility, warning/complaint system, and bidirectional data loop back to Sales."

## Clarifications

### Session 2026-04-17

- Q: What lifecycle states should a Client/Project have after entering Operations? → A: 5-state lifecycle: Onboarding → Active → On Hold → Completed → Churned
- Q: Should notifications be in-app only or also use external channels (email/SMS)? → A: In-app for all notifications + email fallback for warnings only
- Q: Who has permission to change a client's lifecycle state? → A: Account Manager Agent (assigned owner) + Head Account Manager (manager override)

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Head Account Manager Receives & Distributes Closed Deals (Priority: P1)

When the Sales team closes a deal and a project is created, the Head Account Manager sees the new client appear in their dashboard with the full client journey attached (TeleSales data, Sales notes, deal details, contract terms, payment schedule). The Head Account Manager then assigns the client to a specific Account Manager Agent and simultaneously distributes the technical scope to the Head Technical.

**Why this priority**: This is the entry gate for the entire operations layer. Without proper client distribution, no downstream team can begin work. It is the single most critical handoff in the system.

**Independent Test**: Can be fully tested by creating a mock closed deal and verifying that the Head Account Manager dashboard shows all historical data and successfully assigns the client to an Account Manager Agent and Head Technical.

**Acceptance Scenarios**:

1. **Given** a Sales Agent closes a deal and a project record is created, **When** the Head Account Manager opens their dashboard, **Then** the new client appears in the queue with all TeleSales notes, Sales notes, deal details (package type, contract value, payment method, installment schedule, contract dates), and the full client journey timeline.
2. **Given** the Head Account Manager selects a client, **When** they assign it to an Account Manager Agent, **Then** the client record appears in that Agent's dashboard with full history intact and the assignment is logged in the timeline.
3. **Given** the Head Account Manager selects a client, **When** they distribute the technical scope to Head Technical, **Then** Head Technical receives the client with full context, package scope, and current assignment details.
4. **Given** a client has already been assigned, **When** the Head Account Manager reassigns the client to a different Account Manager Agent, **Then** the previous agent loses access, the new agent gains access, and the reassignment is logged in the timeline.

---

### User Story 2 — Account Manager Agent Manages Client Operations & Team Visibility (Priority: P1)

The Account Manager Agent opens their dashboard and sees all clients assigned to them. For each client, they can view the complete journey from lead entry through deal closure. They can see all teams currently working on the client (Social Media, Media Buyer, SEO), the status of every active task, task creation/start/end dates, and notes from every department. The Account Manager can also distribute SEO scope directly to the Head SEO.

**Why this priority**: The Account Manager is the central coordination point for the client. Without this view, there is no single source of truth for what is happening with the client across all teams.

**Independent Test**: Can be tested by assigning a client to an Account Manager Agent and verifying they see the full history, all active teams, task statuses, and can distribute to Head SEO.

**Acceptance Scenarios**:

1. **Given** a client is assigned to an Account Manager Agent, **When** the agent opens the client detail view, **Then** they see the complete journey timeline: lead entry date, TeleSales call logs and notes, Sales meeting notes, deal closing details, and all post-sale activities.
2. **Given** tasks exist for a client across multiple teams, **When** the Account Manager views the client, **Then** they see a consolidated dashboard showing every team assigned, each task's status (Hold, In Progress, Done), creation date, start date, end date, and associated notes.
3. **Given** the Account Manager needs SEO work for a client, **When** they distribute the SEO scope, **Then** Head SEO receives the client with package details and the Account Manager sees the SEO assignment in the team overview.
4. **Given** notes have been added across TeleSales, Sales, and technical teams, **When** the Account Manager views the client notes section, **Then** all notes appear in chronological order with author name, role, department, and timestamp.

---

### User Story 3 — Head Technical Distributes Work to Team Leaders (Priority: P1)

The Head Technical receives client assignments from the Head Account Manager. They review the project scope (package type, contract details) and distribute work to Team Leader Social Media and Team Leader Media Buyer. They do NOT distribute to Head SEO (that comes from the Account Manager).

**Why this priority**: Head Technical is the routing node for two of the three major operational channels. Blocking this blocks Social Media and Media Buyer pipelines entirely.

**Independent Test**: Can be tested by sending a client assignment to Head Technical and verifying they can distribute to Team Leader Social Media and Team Leader Media Buyer, and that the distribution appears in the client timeline.

**Acceptance Scenarios**:

1. **Given** Head Technical receives a client from the Head Account Manager, **When** they open their dashboard, **Then** they see the client with full journey details, package scope, contract terms, and Account Manager assignment.
2. **Given** Head Technical reviews a client, **When** they distribute to Team Leader Social Media, **Then** the Team Leader receives the client with scope details and the assignment is logged.
3. **Given** Head Technical reviews a client, **When** they distribute to Team Leader Media Buyer, **Then** the Team Leader receives the client with scope details and the assignment is logged.
4. **Given** Head Technical has distributed to both Team Leaders, **When** they view the client overview, **Then** they see the distribution status, assigned Team Leaders, and downstream agent assignments.

---

### User Story 4 — Team Leaders Distribute Work to Agents (Priority: P2)

Each Team Leader (Social Media, Media Buyer, SEO) receives client assignments from their respective upstream manager. They review the scope and distribute specific tasks to the agents on their team. Team Leader SEO distributes to SEO Agents, Team Leader Social Media distributes to Social Media Agents, and Team Leader Media Buyer distributes to Media Buyer Agents.

**Why this priority**: This is the final distribution layer before work begins. Critical but depends on upstream distribution being functional first.

**Independent Test**: Can be tested by sending a client to a Team Leader and verifying they can create and assign tasks to their team's agents with proper scope and context.

**Acceptance Scenarios**:

1. **Given** Team Leader Social Media receives a client, **When** they view the client, **Then** they see the full journey, package scope, and all upstream notes.
2. **Given** a Team Leader has reviewed the scope, **When** they assign work to an Agent, **Then** the Agent receives the task with client details, scope description, expected deliverables, and deadline.
3. **Given** multiple Agents are available, **When** the Team Leader assigns work, **Then** they see each Agent's current workload to make informed distribution decisions.
4. **Given** an Agent's task is In Progress, **When** the Team Leader views their team dashboard, **Then** they see real-time status of all tasks across all Agents.

---

### User Story 5 — Cross-Team Task Assignment System (Priority: P2)

Any agent working on a client (Social Media Agent, Media Buyer Agent, SEO Agent) can create a task request that routes to a creative support team (Graphic Design, Motion Graphic, UI/UX, Content SEO). The task goes to the respective Team Leader first, who then distributes it to an Agent on their team. The requesting agent can track the task status.

**Why this priority**: Creative assets are dependencies for nearly every deliverable. Without this cross-team routing, work bottlenecks at the creative teams.

**Independent Test**: Can be tested by having a Social Media Agent create a Graphic Design task and verifying it reaches the Graphic Design Team Leader, gets assigned to a Graphic Design Agent, and the status is visible to the requesting agent, the Account Manager, and all relevant stakeholders.

**Acceptance Scenarios**:

1. **Given** a Social Media Agent needs a graphic asset for a client, **When** they create a task of type "Graphic Design," **Then** the task appears in the Graphic Design Team Leader's queue with client context, requesting agent details, requirements, and deadline.
2. **Given** the Graphic Design Team Leader receives a task, **When** they assign it to a Graphic Design Agent, **Then** the Agent sees the task with all details and the status changes to "In Progress."
3. **Given** a task has been assigned, **When** any stakeholder (requesting Agent, Account Manager, Team Leaders, Head Technical) views the client, **Then** they see the task with its current status (Hold / In Progress / Done), creation date, start date, end date, and notes.
4. **Given** a Graphic Design Agent completes a task, **When** they mark it as "Done," **Then** the requesting Agent, Account Manager, and all relevant Team Leaders receive a notification.
5. **Given** the same cross-team task flow, **When** applied to Motion Graphic, UI/UX, or Content SEO task types, **Then** the identical routing and visibility logic applies (task → respective Team Leader → Agent).

---

### User Story 6 — Universal Notes Visibility & Client Journey (Priority: P2)

Every employee who has access to a client can view all notes ever written about that client — from TeleSales call notes, to Sales meeting notes, to Account Manager notes, to every team's progress notes. Notes are displayed chronologically with full attribution (author, role, department, timestamp). The purpose is to ensure every person working on the client fully understands the client's requirements and history.

**Why this priority**: Notes visibility is the backbone of cross-team understanding. Without it, teams work in silos and client expectations are misunderstood.

**Independent Test**: Can be tested by adding notes from multiple roles (TeleSales, Sales, Account Manager, Social Media Agent) and verifying that any authorized user can see all notes in chronological order with full attribution.

**Acceptance Scenarios**:

1. **Given** a client has notes from TeleSales, Sales, and Account Manager, **When** a Social Media Agent assigned to the client opens the notes section, **Then** they see all notes in chronological order with author name, role, department, and timestamp.
2. **Given** a team Agent adds a note, **When** any other authorized user views the client, **Then** the new note appears in the timeline immediately.
3. **Given** the note list is long, **When** a user searches or filters notes, **Then** they can filter by department, author, or date range.

---

### User Story 7 — Sales Data Loop (Bidirectional Visibility) (Priority: P2)

The Sales Agent or Sales Manager who closed the deal can continue to see the full client journey after handoff to Operations. They can see current progress, which teams are working on the client, task statuses, and team notes. This creates a bidirectional data loop where Sales understands what happens after closing.

**Why this priority**: Sales needs post-sale visibility for client relationship management and for informed conversations if the client contacts them. Also feeds into performance understanding.

**Independent Test**: Can be tested by closing a deal, having Operations teams begin work, and verifying the Sales Agent can see all downstream activity.

**Acceptance Scenarios**:

1. **Given** a Sales Agent closed a deal that is now in Operations, **When** the Sales Agent views the client, **Then** they see the full post-sale journey: Account Manager assignment, team distributions, active tasks, and current statuses.
2. **Given** tasks are in progress across multiple teams, **When** the Sales Agent views the client dashboard, **Then** they see a summary of all teams, their task counts, and overall progress percentage.
3. **Given** a team adds notes or completes tasks, **When** the Sales Agent revisits the client, **Then** they see the updated information in real-time.

---

### User Story 8 — Warning / Complaint System (Priority: P3)

When a client files a complaint, the Account Manager or Sales Agent can click a "Warning" button, write complaint details, and send the warning. The warning triggers a mandatory popup for ALL users involved with that client — Account Manager, Head Account Manager, Head Technical, all Team Leaders, all Agents, Graphic Designers, Motion Designers, UI/UX — across every team. Each user MUST click "Read Warning" before they can continue using the system. The system records that the warning was read (by whom and when). The popup disappears only after the user acknowledges it.

**Why this priority**: Critical for quality control and client retention, but depends on the core operational flows being functional first. A complaint on a non-functional system is meaningless.

**Independent Test**: Can be tested by issuing a warning on a client and verifying that every involved user sees the blocking popup, must acknowledge it, and the acknowledgment is recorded.

**Acceptance Scenarios**:

1. **Given** a client complaint is received, **When** the Account Manager clicks "Warning" and writes complaint notes, **Then** a mandatory popup appears for every user who has any involvement with that client.
2. **Given** a warning popup is displayed, **When** the user does NOT click "Read Warning," **Then** they cannot interact with any other part of the system (navigation blocked, buttons disabled, modal cannot be dismissed by clicking outside).
3. **Given** a warning popup is displayed, **When** the user clicks "Read Warning," **Then** the popup disappears, their acknowledgment is recorded with timestamp, and they regain full system access.
4. **Given** a warning has been sent, **When** an administrator views the warning log, **Then** they see which users have read it, when they read it, and which users have NOT yet read it.
5. **Given** multiple warnings exist for different clients, **When** a user logs in, **Then** ALL unread warnings appear sequentially (one after another) and must each be individually acknowledged.

---

### Edge Cases

- What happens when a client is reassigned from one Account Manager to another mid-project? → All task assignments, team distributions, and notes must transfer seamlessly. The previous Account Manager loses active access but historical notes remain attributed to them.
- What happens when a Team Leader is unavailable and a task needs assignment? → The next-level-up manager (Head Technical or Head SEO) should be able to directly assign to an Agent, bypassing the Team Leader.
- What happens when a warning is sent but a user is offline? → The warning must appear immediately upon their next login, before they can access any other feature.
- What happens when a client has no SEO package but an SEO task is attempted? → The system should validate package scope and prevent assignment to teams not covered by the client's contract.
- What happens when all Agents on a team are at full capacity? → The Team Leader sees a workload indicator and can still assign but receives a capacity warning.
- What happens when a task type does not match any creative team? → The system only allows predefined task types (Graphic Design, Motion Graphic, UI/UX, Content SEO) — no free-text task types.
- What happens when a deal is closed with installment payments and the client misses a payment? → The Account Manager should see a payment status indicator, but payment collection logic is handled by the Accountant role (out of scope for this feature).
- What happens when multiple departments add notes simultaneously? → Notes are appended in timestamp order with no data loss; concurrent writes do not overwrite each other.

---

## Requirements *(mandatory)*

### Functional Requirements

**Client Handoff & Distribution**

- **FR-001**: System MUST automatically surface newly closed deals (projects created from Sales deal closing) in the Head Account Manager's dashboard within 30 seconds of creation.
- **FR-002**: System MUST display the complete client journey when showing a client to any authorized user — including lead entry date, TeleSales call logs with results and notes, Sales meeting notes and feedback, deal closing details (package type, contract value, payment method, installment schedule, contract start/end dates, contract links).
- **FR-003**: Head Account Manager MUST be able to assign a client to any active Account Manager Agent, with the assignment logged in the client timeline.
- **FR-004**: Head Account Manager MUST be able to reassign a client from one Account Manager Agent to another, with the reassignment logged and the previous agent's active access revoked.
- **FR-005**: Head Account Manager MUST be able to distribute the technical scope of a client to Head Technical.
- **FR-006**: Head Technical MUST be able to distribute client work to Team Leader Social Media and Team Leader Media Buyer (but NOT to Head SEO).
- **FR-007**: Account Manager Agent MUST be able to distribute SEO scope to Head SEO.
- **FR-008**: Head SEO MUST be able to distribute SEO work to Team Leader SEO, who then distributes to SEO Agents.
- **FR-009**: Each Team Leader (Social Media, Media Buyer, SEO) MUST be able to assign work to Agents on their respective team.
- **FR-010**: All distribution actions MUST follow the strict hierarchy: top → down. No agent can distribute upward or laterally outside their chain.

**Client Visibility & Journey**

- **FR-011**: Every user with access to a client MUST see the same comprehensive client profile, including all historical data from TeleSales, Sales, and Operations.
- **FR-012**: The client journey timeline MUST display events in chronological order: lead entry, call logs, meeting schedules, deal closing, team assignments, task creation, task status changes, notes, and warnings.
- **FR-013**: Sales Agents and Sales Managers who closed the deal MUST retain read-only visibility into the client's post-sale journey, including team assignments, task statuses, and notes.

**Task System**

- **FR-014**: Any operational Agent (Social Media, Media Buyer, SEO, Content SEO) MUST be able to create a cross-team task request with one of the following types: Graphic Design, Motion Graphic, UI/UX, Content SEO.
- **FR-015**: Cross-team task requests MUST route to the corresponding Team Leader (e.g., Graphic Design task → Leader Graphic Designer).
- **FR-016**: The Team Leader of the creative team MUST be able to assign the received task to an Agent on their team.
- **FR-017**: Every task MUST have the following attributes visible to all stakeholders: task type, client reference, requesting agent, assigned agent, status (Hold / In Progress / Done), creation date, start date, end date, and notes.
- **FR-018**: Task status changes MUST be logged in the client journey timeline.
- **FR-019**: All stakeholders with access to the client (Account Manager, Head Account Manager, Head Technical, Team Leaders, Agents) MUST be able to see the status of every task associated with that client.

**Notes System**

- **FR-020**: All notes associated with a client MUST be visible to every user who has access to that client, regardless of which department created the note.
- **FR-021**: Each note MUST display: author name, author role, department, timestamp, and content.
- **FR-022**: Notes MUST be filterable by department, author, and date range.
- **FR-023**: Adding a note MUST append to the timeline without overwriting or affecting existing notes.

**Warning / Complaint System**

- **FR-024**: Account Managers and Sales Agents MUST be able to issue a warning on any client they have access to, including complaint details in free text.
- **FR-025**: When a warning is issued, a blocking popup MUST appear for every user who has any active involvement with the client (Account Manager, Head Account Manager, Head Technical, Team Leaders, Agents, Creative team members working on tasks for that client).
- **FR-026**: The warning popup MUST block all system interaction until the user clicks "Read Warning" — no navigation, no button clicks, no modal dismissal via outside click or escape key.
- **FR-027**: The system MUST record each user's warning acknowledgment with the user's identity and timestamp.
- **FR-028**: Unread warnings MUST persist across sessions — if a user logs out and logs back in, unread warnings MUST appear before any system access is granted.
- **FR-029**: Multiple unread warnings MUST be presented sequentially (one at a time), each requiring individual acknowledgment.
- **FR-030**: Administrators MUST be able to view a warning log showing: warning content, issuing user, issue date, list of all affected users, and their read/unread status with timestamps.

**Notification Channels**

- **FR-042**: All operational notifications (task assignments, status changes, new client distributions) MUST be delivered in-app only via the system's real-time notification mechanism.
- **FR-043**: Warning/complaint notifications MUST be delivered both in-app (blocking popup per FR-025) AND via email to all affected users, ensuring offline users are alerted to the complaint even when not logged in.

**Role-Based Access Control**

- **FR-031**: The system MUST enforce the following distribution permissions:
  - Head Account Manager → can assign to Account Manager Agents and Head Technical
  - Head Technical → can distribute to Team Leader Social Media and Team Leader Media Buyer
  - Account Manager Agent → can distribute SEO scope to Head SEO
  - Head SEO → can distribute to Team Leader SEO
  - Team Leader SEO → can assign to SEO Agents
  - Team Leader Social Media → can assign to Social Media Agents
  - Team Leader Media Buyer → can assign to Media Buyer Agents
  - Leader Graphic Designer → can assign to Graphic Design Agents
  - Leader Motion Graphic → can assign to Motion Graphic Agents
  - Leader UI → can assign to UI Agents
- **FR-032**: The system MUST NOT allow any role to perform actions outside their defined permissions.
- **FR-033**: The existing TeleSales and Sales dashboards MUST remain exactly as built — no modifications to their interfaces, logic, or permissions.

**Dashboard Requirements**

- **FR-034**: Head Account Manager Dashboard MUST display: incoming clients queue, distributed clients list, Account Manager workload overview, and client status summary cards.
- **FR-035**: Account Manager Agent Dashboard MUST display: assigned clients list, per-client team overview with task statuses, notes feed, and warning indicators.
- **FR-036**: Head Technical Dashboard MUST display: received client assignments, distribution status to Team Leaders, and overall team workload.
- **FR-037**: Team Leader Dashboard MUST display: received client/task assignments, agent workload and availability, task status board (Hold / In Progress / Done), and team performance metrics.
- **FR-038**: Agent Dashboard (for all operational agents) MUST display: assigned tasks with full client context, task status controls, notes input, and cross-team task creation form.
- **FR-039**: Creative Team Agent Dashboard (Graphic, Motion, UI) MUST display: incoming task requests with client context and requesting agent details, task status controls, and deliverable notes.

**Client Lifecycle**

- **FR-040**: Each Client/Project MUST have a lifecycle state: Onboarding, Active, On Hold, Completed, or Churned. The state MUST be visible on all dashboards that display client information.
- **FR-041**: All dashboard client lists MUST be filterable by lifecycle state. The default view MUST show Onboarding and Active clients.
- **FR-044**: Only the assigned Account Manager Agent and the Head Account Manager MUST be able to change a client's lifecycle state. All other roles MUST have read-only visibility of the state. State transitions MUST be logged in the client journey timeline with the user who made the change and timestamp.

### Key Entities

- **Client/Project**: The central entity representing a closed deal. Contains contract details, package type, payment terms, assigned teams, and the full journey timeline from lead to active project. Lifecycle states: **Onboarding** (newly received from Sales, distribution in progress) → **Active** (all teams assigned, work underway) → **On Hold** (work paused due to client request, payment issue, or internal decision) → **Completed** (all deliverables fulfilled, contract ended normally) → **Churned** (client left before completion or did not renew).
- **Assignment**: A record linking a client to a role/user, with timestamp, assigning authority, and status. Supports the hierarchical distribution chain.
- **Task**: A cross-team work request with type, client reference, requesting agent, assigned agent, status lifecycle (Hold → In Progress → Done), dates, and notes.
- **Note**: A timestamped text entry attached to a client, attributed to an author with role and department metadata.
- **Warning**: A complaint-triggered alert attached to a client, with content, issuing user, affected users list, and per-user acknowledgment records.
- **Timeline Event**: A polymorphic event record (call log, meeting, assignment, task change, note, warning) that forms the chronological client journey.
- **Team/Department**: Organizational grouping (TeleSales, Sales, Account Management, Social Media, Media Buying, SEO, Graphic Design, Motion Graphic, UI, Content SEO) with hierarchical structure.
- **Workload**: A derived metric per agent showing current task count, active client count, and capacity indicator.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of closed deals appear in the Head Account Manager's dashboard within 30 seconds of deal closure.
- **SC-002**: Account Manager Agents can view the complete client journey (from lead entry to current status) within 3 seconds of opening a client record.
- **SC-003**: Cross-team task requests are delivered to the target Team Leader's queue within 10 seconds of creation.
- **SC-004**: 100% of warning popups are delivered to all affected users within 15 seconds of issuance.
- **SC-005**: 100% of warning acknowledgments are recorded with correct user identity and timestamp.
- **SC-006**: Any authorized user can view all notes for a client in under 2 seconds, regardless of note volume (up to 500 notes per client).
- **SC-007**: Sales Agents can see the current post-sale status of their closed deals without navigating more than 2 clicks from their dashboard.
- **SC-008**: Task status changes are reflected across all stakeholder dashboards within 5 seconds of the change.
- **SC-009**: The system supports at least 100 concurrent users across all roles without performance degradation.
- **SC-010**: No user can perform an action outside their role-defined permissions — 100% enforcement on all role boundaries.
- **SC-011**: Client reassignment from one Account Manager to another completes in under 5 seconds with zero data loss.
- **SC-012**: The complete distribution chain (Head Account Manager → Account Manager + Head Technical → Team Leaders → Agents) can be completed in under 5 minutes per client.

---

## Assumptions

- The existing TeleSales and Sales workspaces are fully functional and will not be modified. This specification builds on top of them.
- The deal closing form in Sales already creates a project record that triggers the handoff to Operations. This specification assumes that project record contains: package type, contract value, payment details, installment schedule, contract dates, and contract links.
- The HR Manager and Accountant roles exist in the system but are out of scope for this feature. The Accountant handles payment tracking separately.
- Users authenticate through the existing system authentication mechanism. No new authentication flows are introduced.
- The system is web-based and accessed via modern browsers (Chrome, Firefox, Edge, Safari).
- Real-time updates (task status changes, new assignments) are delivered in-app only. Warning/complaint alerts additionally trigger an email to all affected users to ensure offline reach. The specific real-time mechanism (polling, WebSocket, SSE) is an implementation decision.
- The organizational hierarchy is fixed as described and does not support dynamic restructuring in this version.
- Each Team Leader manages a finite team of Agents. The maximum team size is assumed to be 20 Agents per Team Leader.
- The "package type" determines which teams are engaged (e.g., SEO-only package does not engage Social Media or Media Buyer teams). Scope validation is assumed.
- Cold leads, recycle bin (lost leads), and meeting scheduling are handled by the existing TeleSales/Sales systems and are not duplicated here.
- The Chief Sales role has read-only oversight visibility across Sales and Operations but does not participate in active distribution.
