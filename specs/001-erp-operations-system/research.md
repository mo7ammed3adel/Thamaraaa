# Research: ERP Operations System

**Branch**: `001-erp-operations-system` | **Date**: 2026-04-17

## R1: Existing Tech Stack Assessment

**Decision**: Build on the existing Next.js 14 + Prisma + PostgreSQL + Pusher stack.  
**Rationale**: The project already has a production-ready infrastructure with:
- Next.js 14 App Router with TypeScript
- Prisma ORM with PostgreSQL (via `DATABASE_URL`)
- NextAuth v4 for authentication with role-based session management
- Pusher (server + client) for real-time WebSocket events
- TailwindCSS 3.4 for styling with `tailwind-merge` + `clsx`
- Lucide React for icons
- Role constants and `hasRole()` utility already defined in `src/lib/constants.ts`

**Alternatives considered**: None — there is no reason to change the stack. All new features are extensions of existing patterns.

## R2: Schema Gap Analysis

**Decision**: Extend existing Prisma schema with targeted additions, not a rewrite.  
**Rationale**: The existing schema already has:
- `Project` model with `accountManagerId`, `headTechnicalId`, `headSeoId`, `projectStatus`, `finalStatus`
- `Task` model with `parentTask/subTasks`, `taskType`, `status`, `requesterRole`, `assignedRole`, `priority`
- `Warning` model with `acknowledgedBy` (JSON), `recipientRoles`, `severity`
- `Note` model with `userId`, `userRole`, `userName`, `category`
- `ProjectLog` model for timeline events
- `Notification` model for in-app notifications

**Gaps to fill**:
1. `Project.projectStatus` has 8 states but no `churned` state — needs adding to match the 5-state lifecycle spec
2. `Warning` model stores `acknowledgedBy` as a JSON string — functional but suboptimal for querying who has/hasn't read. A `WarningReceipt` join table is needed for reliable enforcement
3. No `TeamAssignment` model — tracking which Team Leaders and Agents are actively assigned to a project
4. `Project.finalStatus` (`Active/Lost/Done`) partially overlaps with `projectStatus` — needs consolidation into the 5-state lifecycle
5. No email notification integration for warnings

## R3: Real-Time Architecture (Pusher)

**Decision**: Use existing Pusher channels for all in-app real-time events.  
**Rationale**: Pusher is already configured and in use. Channels strategy:
- `private-user-{userId}` — per-user channel for personal notifications, warnings
- `private-project-{projectId}` — per-project channel for task updates, notes, status changes
- `presence-dashboard-{role}` — optional for online status tracking

**Alternatives considered**: WebSocket (manual setup) — rejected because Pusher is already paid for, configured, and working.

## R4: Email for Warning Notifications

**Decision**: Use a lightweight email service (Resend, Nodemailer, or SMTP) for warning-only emails.  
**Rationale**: Only warnings need email delivery (per clarification Q2). This is a narrow scope — a simple `sendWarningEmail()` utility function is sufficient. No need for a full email marketing platform.

**Alternatives considered**: 
- SendGrid — overkill for warning-only emails
- Built-in SMTP via `nodemailer` — simplest option, works with any SMTP provider
- Resend — modern, simple API, good DX

**Decision**: Use `nodemailer` with environment-configured SMTP since it requires no external account creation and works with any provider (Gmail SMTP, SES, etc.).

## R5: Dashboard Pattern Analysis

**Decision**: Follow existing page pattern: Server Component (`page.tsx`) for data fetching → Client Component (`*Client.tsx`) for interactivity.  
**Rationale**: Every existing dashboard follows this exact pattern:
- `page.tsx` — async server component, fetches data via Prisma, passes as props
- `*Client.tsx` — "use client" component with state, filters, modals, Pusher subscriptions

This pattern is already used in:
- `head-account-manager/page.tsx` → `HeadAccountManagerClient.tsx`
- `account-manager/page.tsx` → `AccountManagerClient.tsx`
- `head-technical/page.tsx` → `HeadTechnicalClient.tsx`
- `seo/page.tsx` → `SeoClient.tsx`
- `social-media/page.tsx` → `SocialMediaClient.tsx`
- `design/page.tsx` → `DesignClient.tsx`

## R6: API Route Pattern

**Decision**: Follow existing API route pattern with role-checking at boundary.  
**Rationale**: Existing API routes in `src/app/api/` follow:
1. Parse session via `getServerSession(authOptions)`
2. Check `hasRole(session.user.role, ALLOWED_ROLES)`
3. Validate input  
4. Execute Prisma query
5. Return JSON response

New API endpoints will follow this identical pattern. All new routes will be added under existing API directories where applicable (e.g., `api/projects/`, `api/tasks/`, `api/warnings/`).
