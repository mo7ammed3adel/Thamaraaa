# Feature Specification: Operations & Task Distribution System

**Feature Branch**: `002-operations-task-distribution`  
**Created**: 2026-04-23  
**Status**: Draft  
**Input**: User description: "Build the full Operations layer that receives clients after deal closure and routes them through Account Management, Technical teams, SEO teams, and Design teams with hierarchical task distribution, full client journey visibility, and a mandatory blocking Warning system."

## Clarifications

### Session 2026-04-23

- Q: What states does a client go through in the operations pipeline? → A: 3 states — Active, On Hold, Completed — controlled by the Account Manager Agent.
- Q: Can Team Leaders or Agents reject/reassign tasks? → A: Team Leaders can reassign tasks within their team; agents can flag/return tasks to their Team Leader with a reason. The originating agent is notified but cannot override.
- Q: Do Warnings have a resolution lifecycle? → A: Yes. The Warning creator can mark it as "Resolved" after the issue is addressed. Open Warnings remain visible in the client file until formally closed.
- Q: Can clients be reassigned between Account Manager Agents? → A: Only the Head Account Manager can reassign. All client history, team assignments, and task data are preserved during transfer.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Head Account Manager Receives and Distributes Clients (Priority: P1)

After a deal is closed by the Sales team, the Head Account Manager sees the new client appear in their dashboard with all relevant information including client name, entry date, contact details, and the agreed package or service. They click on the client to view the complete client journey — every note written by TeleSales, every note written by Sales, and all remarks from every stage. From that same page, they assign the client to an Account Manager Agent on their team, or directly to the Head Technical if technical involvement is needed, or to the Head SEO if the client primarily needs SEO services.

**Why this priority**: This is the entry point for the entire operations flow. Without the Head Account Manager receiving and distributing clients, no downstream work can begin. This is the single most critical handoff in the system.

**Independent Test**: Can be fully tested by closing a deal in Sales and verifying the client appears in the Head Account Manager dashboard with full journey data. Assigning the client to an Account Manager Agent and verifying it appears in that agent's dashboard confirms the distribution logic.

**Acceptance Scenarios**:

1. **Given** a deal is closed by Sales, **When** the Head Account Manager opens their dashboard, **Then** the new client appears in their client list with name, entry date, contact information, and agreed package.
2. **Given** the Head Account Manager clicks on a client, **When** the client detail page opens, **Then** all notes from TeleSales and Sales are displayed in chronological order as part of the client journey.
3. **Given** the Head Account Manager is on a client's detail page, **When** they click the Assign button, **Then** a list of available Account Manager Agents, Head Technical, and Head SEO is shown for selection.
4. **Given** the Head Account Manager assigns a client to an Account Manager Agent, **When** the assignment is confirmed, **Then** the client appears in the Account Manager Agent's dashboard with full journey data.

---

### User Story 2 - Account Manager Agent Manages Client and Monitors Progress (Priority: P1)

The Account Manager Agent sees all clients assigned to them by the Head Account Manager. They open a client to view the complete journey from TeleSales through Sales, including all notes and remarks from every employee. They write their own notes on the client which become visible to everyone viewing that client's file. They can see the complete team working on each client — who the Media Buyer is, who the Social Media agent is, who the SEO agent is — and a full list of all tasks created for the client across all departments with status (hold, in progress, done), creator, creation date, and completion date.

**Why this priority**: The Account Manager Agent is the primary person responsible for the client relationship. They must have full visibility of team assignments and task progress to manage the client effectively.

**Independent Test**: Can be tested by assigning a client to an Account Manager Agent and verifying they see the full journey, can write notes, and can see team composition and task statuses.

**Acceptance Scenarios**:

1. **Given** a client is assigned to an Account Manager Agent, **When** they open their dashboard, **Then** the client appears in their list.
2. **Given** the Account Manager Agent opens a client, **When** the client detail page loads, **Then** all notes from TeleSales, Sales, and any other employee are displayed chronologically.
3. **Given** the Account Manager Agent writes a note on a client, **When** any other employee views that client's file, **Then** the new note is visible.
4. **Given** tasks have been created for a client across departments, **When** the Account Manager Agent views the client, **Then** all tasks are listed with their status, creator, creation date, and completion date.
5. **Given** team members have been assigned to a client, **When** the Account Manager Agent views the client, **Then** the names and roles of all assigned team members are visible.

---

### User Story 3 - Hierarchical Task Distribution Through Team Leaders (Priority: P1)

The Head Technical receives clients from the Head Account Manager and assigns them to Team Leader Social Media and/or Team Leader Media Buyer. The Head SEO receives clients from the Head Account Manager or Account Manager Agent and assigns them to Team Leader SEO. Each Team Leader then assigns clients or tasks to the agents on their team. At every level, the person can view the client's complete journey and all notes from every employee.

**Why this priority**: The hierarchical distribution chain is the backbone of the operations workflow. Without it, work cannot flow from management to execution teams.

**Independent Test**: Can be tested by tracing a client from Head Account Manager → Head Technical → Team Leader Social Media → Social Media Agent and verifying the client data and journey are visible at each level.

**Acceptance Scenarios**:

1. **Given** the Head Account Manager assigns a client to Head Technical, **When** the Head Technical opens their dashboard, **Then** the client appears with full journey data.
2. **Given** the Head Technical views a client, **When** they click Assign, **Then** they can choose from Team Leader Social Media and Team Leader Media Buyer only (not Head SEO).
3. **Given** the Head SEO receives a client, **When** they click Assign, **Then** they can assign only to Team Leader SEO.
4. **Given** a Team Leader receives a client, **When** they open the client page, **Then** all notes from every previous stage are visible.
5. **Given** a Team Leader assigns a client to an Agent, **When** the Agent opens their dashboard, **Then** the client and all journey data are accessible.

---

### User Story 4 - Cross-Department Task Creation by Agents (Priority: P2)

Social Media Agents, Media Buyer Agents, SEO Agents, and Content SEO Agents can create tasks from their dashboards and assign them to design departments. A Social Media Agent or Media Buyer Agent can create tasks for Team Leader Graphic Designer (static design), Team Leader Motion Graphic (video/motion), or Team Leader UI/UX (interface design). An SEO Agent or Content SEO Agent can create tasks for Team Leader Graphic Designer or Team Leader UI/UX. Each task includes a task link and specifies the type of work required. The task goes to the relevant Team Leader first, who then distributes it to their Agent.

**Why this priority**: Cross-department task routing enables the actual production work to happen. Without it, operational agents cannot request design assets from creative teams.

**Independent Test**: Can be tested by logging in as a Social Media Agent, creating a design task with a link and description, and verifying it appears in the Team Leader Graphic Designer's dashboard.

**Acceptance Scenarios**:

1. **Given** a Social Media Agent is on their client dashboard, **When** they click "Assign Task," **Then** they can select the target department (Graphic Design, Motion Graphic, or UI/UX).
2. **Given** a task is created with a link and work type, **When** the relevant Team Leader opens their dashboard, **Then** the task appears with all details including link, work type, creation date, and originating agent.
3. **Given** the Team Leader Graphic Designer receives a task, **When** they assign it to a Graphic Designer Agent, **Then** the agent sees the task with all details and can access the client's full journey notes.
4. **Given** an SEO Agent creates a task, **When** they select the target, **Then** only Team Leader Graphic Designer and Team Leader UI/UX are available (not Motion Graphic).
5. **Given** a Media Buyer Agent creates a task, **When** they select the target, **Then** Team Leader Graphic Designer, Team Leader Motion Graphic, and Team Leader UI/UX are all available.

---

### User Story 5 - Task Status Management by Design and Production Agents (Priority: P2)

Graphic Designer Agents, Motion Graphic Agents, and UI/UX Agents receive tasks from their respective Team Leaders. Each agent sees their assigned tasks with all details and links. They can open the client's page associated with each task to view the full journey notes from all employees since the client first entered the system. They update the status of each task through three states: hold → in progress → done.

**Why this priority**: Without status tracking, no one in the system — Account Managers, Team Leaders, or Head Technical — can monitor progress or identify bottlenecks.

**Independent Test**: Can be tested by assigning a task to a Graphic Designer Agent, verifying they see the task details, and updating the status from hold to in progress to done while verifying the change is reflected on the Team Leader's and Account Manager's dashboards.

**Acceptance Scenarios**:

1. **Given** a task is assigned to a Graphic Designer Agent, **When** they open their dashboard, **Then** the task appears with link, work type, creation date, and client information.
2. **Given** the agent opens the client page for a task, **When** the page loads, **Then** all notes from TeleSales, Sales, Account Manager, and other team members are visible.
3. **Given** the agent updates a task status from "hold" to "in progress," **When** the Team Leader views their task list, **Then** the updated status is reflected immediately.
4. **Given** the agent marks a task as "done," **When** the Account Manager Agent views the client, **Then** the task shows as completed with the completion date.

---

### User Story 6 - Mandatory Blocking Warning System (Priority: P2)

An Account Manager Agent or Sales agent can write a Warning on any client when the client complains or there is a problem with the work. They click the Warning button on the client's page, write the details of the problem, and send it. At that moment a mandatory popup is pushed to every employee in the company who has that client in their dashboard — meaning every account manager, head, team leader, and agent with any connection to that client. The popup blocks them from using anything in the system until they click the "Mark as Read" button. Their confirmation is logged and the popup is dismissed so they can continue their work.

**Why this priority**: The Warning system is critical for client retention and quality assurance. It ensures every team member is immediately aware of client issues and cannot ignore them.

**Independent Test**: Can be tested by logging in as an Account Manager Agent, sending a Warning on a client, then verifying that every employee connected to that client sees a blocking popup and cannot interact with the system until they acknowledge it.

**Acceptance Scenarios**:

1. **Given** an Account Manager Agent clicks the Warning button on a client, **When** they write the problem details and click send, **Then** a mandatory popup appears on every dashboard that has this client.
2. **Given** a Warning popup appears on an employee's screen, **When** the employee tries to click any other element or navigate, **Then** the system prevents all interaction until "Mark as Read" is clicked.
3. **Given** an employee clicks "Mark as Read," **When** the confirmation is logged, **Then** the popup dismisses and the employee regains full system access.
4. **Given** a Warning is sent, **When** the Warning sender checks, **Then** they can see which employees have read the Warning and which have not.
5. **Given** a Head Account Manager receives a Warning popup sent by an Account Manager Agent, **When** they read and dismiss it, **Then** their acknowledgment is recorded.

---

### User Story 7 - Client Journey Visibility Across All Roles (Priority: P3)

Every employee who has access to a client can view the client's complete journey from the moment the lead first entered with TeleSales, through the Sales discovery and deal closing stage, through Account Manager notes, and all the way through to the current operational status. This journey includes all notes written by every employee at every stage, task statuses, team assignments, and timeline of events.

**Why this priority**: Full journey visibility ensures no context is ever lost as the client moves through departments. This reduces miscommunication, prevents repeated questions to the client, and enables every team member to work with full context.

**Independent Test**: Can be tested by logging in as a Graphic Designer Agent assigned a task for a client, opening the client page, and verifying that TeleSales notes, Sales notes, Account Manager notes, and all team notes are visible.

**Acceptance Scenarios**:

1. **Given** any employee opens a client page, **When** the journey section loads, **Then** notes from every stage (TeleSales, Sales, Account Manager, Team members) are displayed in chronological order.
2. **Given** a new note is written by any employee, **When** another employee views the same client, **Then** the new note appears in the journey timeline.
3. **Given** a Graphic Designer Agent wants to understand client requirements beyond the task brief, **When** they open the client page, **Then** they can read all previous notes and context.

---

### Edge Cases

- What happens when a client is assigned to multiple departments simultaneously (e.g., both Social Media and Media Buyer via Head Technical, and SEO via Head SEO)? The client must appear independently in each department's pipeline without conflict.
- What happens when a Warning is sent and an employee is currently offline or logged out? The Warning popup must appear immediately upon their next login or page reload.
- What happens when the Head Account Manager tries to assign a client to a Team Leader or Agent who already has a high workload? The system should display the current assignment count for each person in the assignment list.
- What happens when a task is created for a client but the client has been removed or archived? The system must prevent task creation for archived or removed clients.
- What happens when an employee writes a Warning but the team working on the client changes before all employees read it? The Warning must be delivered based on the team snapshot at the time of sending, not at the time of reading.
- What happens when two people send a Warning on the same client at nearly the same time? Both Warnings must be delivered as separate popups, each requiring independent acknowledgment.
- What happens when an agent flags/returns a task to the Team Leader? The task returns to the Team Leader's queue with the agent's reason, and the Team Leader can reassign to another agent or clarify and re-assign to the same agent.
- What happens when a client is reassigned from one Account Manager Agent to another? All history, team assignments, tasks, notes, and Warnings must transfer seamlessly. The new Account Manager Agent sees the complete client file as if they had always owned it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display all clients transferred to the Head Account Manager from the Sales team with name, entry date, contact information, and agreed package.
- **FR-002**: System MUST allow the Head Account Manager to assign a client to an Account Manager Agent, Head Technical, or Head SEO from the client detail page.
- **FR-003**: System MUST display the complete client journey (all notes, all stages) when any authorized employee opens a client's detail page.
- **FR-004**: System MUST allow every employee with client access to write notes on the client that become visible in the client journey for all other authorized viewers.
- **FR-005**: System MUST support hierarchical client distribution: Head Account Manager → Account Manager Agent / Head Technical / Head SEO → Team Leaders → Agents.
- **FR-006**: System MUST allow Head Technical to assign clients only to Team Leader Social Media and Team Leader Media Buyer (not to Head SEO, which is a separate track).
- **FR-007**: System MUST allow Head SEO to assign clients only to Team Leader SEO.
- **FR-008**: System MUST allow Team Leaders to assign clients or tasks to Agents on their team only.
- **FR-009**: System MUST allow Social Media Agents and Media Buyer Agents to create tasks assigned to Team Leader Graphic Designer, Team Leader Motion Graphic, or Team Leader UI/UX.
- **FR-010**: System MUST allow SEO Agents and Content SEO Agents to create tasks assigned to Team Leader Graphic Designer or Team Leader UI/UX (not Motion Graphic).
- **FR-011**: System MUST require each cross-department task to include a task link and work type specification.
- **FR-012**: System MUST route cross-department tasks to the relevant Team Leader first, who then distributes to their Agent.
- **FR-013**: System MUST support three task statuses: hold, in progress, and done.
- **FR-014**: System MUST allow design and production agents (Graphic Designer, Motion Graphic, UI/UX) to update the status of their assigned tasks.
- **FR-015**: System MUST display, for each client, the complete team working on them including names and roles of all assigned employees across all departments.
- **FR-016**: System MUST display, for each client, a list of all tasks across all departments with status, creator, creation date, and completion date.
- **FR-017**: System MUST allow Account Manager Agents and Sales agents to create a Warning on any client in their dashboard.
- **FR-018**: System MUST push Warning popups as mandatory blocking overlays to every employee who has the warned client in their dashboard.
- **FR-019**: System MUST prevent all system interaction while a Warning popup is displayed, until the employee clicks "Mark as Read."
- **FR-020**: System MUST log the acknowledgment of each Warning (who read it and when).
- **FR-021**: System MUST deliver pending Warning popups to employees who were offline when the Warning was sent, upon their next login or page reload.
- **FR-022**: System MUST display the current assignment count for each person in the assignment list when a Head or Team Leader is distributing clients.
- **FR-023**: System MUST support three client lifecycle states in operations: Active, On Hold, and Completed.
- **FR-024**: System MUST allow only the Account Manager Agent to transition a client between Active, On Hold, and Completed states.
- **FR-025**: System MUST default new clients entering operations to the Active state.
- **FR-026**: System MUST allow Team Leaders to reassign a task from one agent to another agent within their own team.
- **FR-027**: System MUST allow design and production agents to flag/return a task to their Team Leader with a mandatory reason text.
- **FR-028**: System MUST notify the originating agent (the one who created the cross-department task) when a task they created is reassigned or flagged back.
- **FR-029**: System MUST allow the Warning creator to mark a Warning as "Resolved" after the underlying issue has been addressed.
- **FR-030**: System MUST keep open (unresolved) Warnings visible in the client's file and distinguishable from resolved Warnings.
- **FR-031**: System MUST NOT allow anyone other than the Warning creator to resolve a Warning.
- **FR-032**: System MUST allow the Head Account Manager to reassign a client from one Account Manager Agent to another.
- **FR-033**: System MUST preserve all client history, team assignments, tasks, notes, and Warnings when a client is reassigned between Account Manager Agents.
- **FR-034**: System MUST NOT allow Account Manager Agents to transfer their own clients to another Agent — only the Head Account Manager has this authority.

### Key Entities

- **Client**: Represents a paying customer who has completed the sales process. Key attributes: name, entry date, contact information, agreed package/service, lifecycle status (Active / On Hold / Completed), assigned team members across departments. The Account Manager Agent controls state transitions.
- **Client Journey**: A chronological record of all notes, interactions, and milestones from the moment the lead entered as a TeleSales lead through deal closure and into operations. Linked to the Client.
- **Note**: A text entry written by any employee on a client, timestamped and attributed to the author. Visible to all authorized viewers of that client.
- **Assignment**: A record of a client being assigned from one role to another in the hierarchy. Captures who assigned, who received, and when.
- **Task**: A unit of work created by an operational agent (Social Media, Media Buyer, SEO, Content SEO) targeting a design or production team. Key attributes: task link, work type, status (hold/in progress/done), creator, assignee, creation date, completion date, flag reason (if returned by agent). Linked to a Client. Tasks can be reassigned by Team Leaders within their team, and agents can flag tasks back to their Team Leader with a reason.
- **Warning**: An urgent notification created by an Account Manager Agent or Sales agent on a client. Key attributes: author, timestamp, problem description, resolution status (Open / Resolved), resolution date, target recipients (all employees connected to the client), acknowledgment log (who read, when). Only the Warning creator can mark it as Resolved.
- **Team**: A grouping under a Team Leader. Each team consists of the Team Leader and their agents. Teams are department-specific (Social Media, Media Buyer, SEO, Graphic Design, Motion Graphic, UI/UX).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A closed deal client is visible in the Head Account Manager's dashboard within 30 seconds of deal closure.
- **SC-002**: From the Head Account Manager assigning a client to the assigned employee seeing that client in their dashboard, the latency must be under 10 seconds.
- **SC-003**: The complete client journey (all notes from all stages) loads in under 3 seconds when any employee opens a client detail page.
- **SC-004**: 100% of Warning popups are delivered to all connected employees, with zero missed deliveries.
- **SC-005**: An employee receiving a Warning popup cannot perform any system action until they acknowledge it — enforced with zero bypass paths.
- **SC-006**: Account Manager Agents can view the complete team and task status for any of their clients in a single page without navigating to other dashboards.
- **SC-007**: Cross-department tasks created by operational agents appear in the target Team Leader's dashboard within 10 seconds.
- **SC-008**: The system supports 500 concurrent users across all roles without performance degradation.
- **SC-009**: Task status changes (hold → in progress → done) are reflected across all dashboards viewing that task within 5 seconds.
- **SC-010**: 95% of employees complete client assignment in under 1 minute (from opening client page to confirming assignment).

## Assumptions

- The TeleSales and Sales modules are already fully built and operational, and their data (leads, notes, deal closures) is available for the operations layer to read.
- The existing role-based access control (RBAC) system already supports the 24 roles defined in the system and can enforce dashboard-level permissions.
- The warning system operates within the web application only; no SMS, email, or push notification delivery outside the browser is required for the initial version.
- A client can be assigned to multiple departments simultaneously (e.g., Social Media and SEO at the same time) and each department manages their work independently.
- The Chief Sales, HR Manager, and Accountant roles are completely isolated from the operations client journey and Warning system — their dashboards are administrative only.
- The existing user authentication and session management system is reused.
- Mobile-responsive design is expected but a dedicated native mobile app is out of scope for this version.
- Real-time updates (task status changes, Warning delivery) are expected to function via polling or WebSocket — the specific mechanism is an implementation detail.
