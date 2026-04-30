# Quickstart: ERP Operations System

**Branch**: `001-erp-operations-system` | **Date**: 2026-04-17

## Prerequisites

- Node.js 18+
- PostgreSQL database (connection string in `.env`)
- Pusher account (keys in `.env`)
- SMTP credentials for warning emails (in `.env`)

## Environment Variables (new additions)

Add these to your existing `.env` file:

```env
# Email (for warning notifications only)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@thamaraa.com
```

All other env vars (`DATABASE_URL`, `NEXTAUTH_SECRET`, `PUSHER_*`) are already configured.

## Setup Steps

```bash
# 1. Switch to feature branch
git checkout 001-erp-operations-system

# 2. Install any new dependencies
npm install nodemailer
npm install -D @types/nodemailer

# 3. Apply schema changes
npx prisma migrate dev --name add-operations-system

# 4. Generate Prisma client
npx prisma generate

# 5. Seed new test data (if seed script updated)
npx prisma db seed

# 6. Start dev server
npm run dev
```

## New Routes to Verify

After setup, verify these dashboard routes load correctly:

| Route | Role | Description |
|-------|------|-------------|
| `/dashboard/head-account-manager` | head_account_manager | Client queue + distribution |
| `/dashboard/account-manager` | account_manager | Assigned clients + team overview |
| `/dashboard/head-technical` | head_technical | Distribution to Team Leaders |
| `/dashboard/seo` | head_seo, team_leader_seo, agent_seo | SEO workspace |
| `/dashboard/social-media` | team_leader_social_media, agent_social_media | Social Media workspace |
| `/dashboard/media-buyer` | team_leader_media_buyer, agent_media_buyer | Media Buyer workspace |
| `/dashboard/design` | leader_graphic_designer, leader_motion_graphic, leader_ui, agents | Creative tasks |
| `/dashboard/warnings` | all roles | Warning center + log |

## Key Files Modified/Created

### Schema
- `prisma/schema.prisma` — TeamAssignment, WarningReceipt models + Project.lifecycleState

### API Routes (new/modified)
- `src/app/api/projects/[id]/assign-account-manager/route.ts`
- `src/app/api/projects/[id]/assign-head-technical/route.ts`
- `src/app/api/projects/[id]/assign-head-seo/route.ts`
- `src/app/api/projects/[id]/distribute-team/route.ts`
- `src/app/api/projects/[id]/assign-agent/route.ts`
- `src/app/api/projects/[id]/lifecycle/route.ts`
- `src/app/api/projects/[id]/teams/route.ts`
- `src/app/api/projects/[id]/journey/route.ts`
- `src/app/api/warnings/[id]/acknowledge/route.ts`
- `src/app/api/warnings/unread/route.ts`
- `src/app/api/warnings/log/route.ts`

### Lib (new)
- `src/lib/email.ts` — SMTP email utility for warnings
- `src/lib/distribution.ts` — Distribution permission validation
- `src/lib/lifecycle.ts` — Lifecycle state transition validation

### Components (new/modified)
- `src/components/WarningPopup.tsx` — Enhanced blocking modal
- `src/components/ClientJourney.tsx` — Enhanced timeline
- `src/components/TeamOverview.tsx` — New team status panel
- `src/components/LifecycleStateBadge.tsx` — New status badge
- `src/components/CrossTeamTaskForm.tsx` — New task creation form

### Dashboard Pages (modified)
- `src/app/dashboard/head-account-manager/` — Distribution UI
- `src/app/dashboard/account-manager/` — Team visibility + SEO distribution
- `src/app/dashboard/head-technical/` — Team Leader distribution
- `src/app/dashboard/seo/` — Agent assignment
- `src/app/dashboard/social-media/` — Agent assignment + task creation
- `src/app/dashboard/media-buyer/` — Agent assignment + task creation
- `src/app/dashboard/design/` — Incoming task queue
- `src/app/dashboard/layout.tsx` — Warning popup integration (global)
