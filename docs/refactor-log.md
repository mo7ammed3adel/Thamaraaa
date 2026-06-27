# Refactor Log

## 2026-06-27 - Phase 0 Baseline

Scope: establish the safety baseline before any behavior-preserving refactor work.

Checks:

- `git status --short --branch`: clean except the new refactor roadmap files.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with existing React hook dependency warnings in:
  - `src/app/dashboard/chief-sales/ChiefSalesClient.tsx`
  - `src/app/dashboard/media-buyer/MediaBuyerClient.tsx`
  - `src/app/dashboard/social-media/SocialMediaClient.tsx`
  - `src/components/ClientReassignModal.tsx`
  - `src/components/NotesPanel.tsx`
  - `src/components/TaskReassignModal.tsx`
- `npm test`: passed, 7 files and 30 tests.
- `npm run build`: passed.

Baseline decision:

- Proceed with Phase 1 from `specs/003-code-refactor-roadmap/spec.md`.
- Existing lint warnings are recorded as baseline noise and should not be mixed into unrelated refactor commits.

## 2026-06-27 - Phase 1 Slice: Roles Contract and JSON Parser

Scope:

- Added `src/contracts/roles.ts` as the first shared contract surface for stored user role values and labels.
- Added `src/server/parsers/json.ts` for safe JSON parsing/stringifying at server boundaries.
- Replaced local JSON parsing in `src/lib/commissions.ts` with the shared parser helpers.

Smell -> principle -> fix:

- Repeated local `JSON.parse` try/catch in `src/lib/commissions.ts` -> SRP / boundary parsing -> moved parsing mechanics into `src/server/parsers/json.ts`.
- Role strings had no central contract -> precise types / naming -> added `UserRole`, `isUserRole`, and `getRoleLabel` in `src/contracts/roles.ts`.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test -- --run src/lib/__tests__/telesalesBonus.test.ts`: passed, 8 tests.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 1 Slice: DTO Contracts

Scope:

- Added type-only DTO contracts for projects, tasks, warnings, and finance records.
- Did not migrate runtime call sites yet; this creates the shared contract surface for later route and UI extraction.

Smell -> principle -> fix:

- Frontend and backend data shapes were implicit in components/routes -> API boundary contract -> added explicit DTO files under `src/contracts`.

Behavior preserved by:

- `npx tsc --noEmit`: passed.

## 2026-06-27 - Phase 1 Slice: Specialized Server Parsers

Scope:

- Added finance, HR, and task parser modules under `src/server/parsers`.
- Moved deliverable file normalization out of `src/app/api/tasks/[id]/route.ts`.
- Reused finance line-item parsing in `src/lib/commissions.ts`.
- Reused HR performance history parsing in `src/lib/promotion.ts`.

Smell -> principle -> fix:

- `src/app/api/tasks/[id]/route.ts` mixed route delivery with deliverable URL parsing -> SRP / boundary parsing -> moved parser logic to `src/server/parsers/task.ts`.
- Finance and HR JSON data had local parsing rules -> single parsing owner -> added `src/server/parsers/finance.ts` and `src/server/parsers/hr.ts`.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Warning Create Boundary

Scope:

- Moved warning creation, authorization, receipt creation, pusher delivery, and email delivery marking into `src/server/services/warningService.ts`.
- Reduced POST `/api/warnings` to request parsing, service call, and response mapping.
- Completed the warning service coverage for create/list/acknowledge/resolve flows.

Smell -> principle -> fix:

- `src/app/api/warnings/route.ts` handled business authorization, transaction orchestration, realtime delivery, and email side effects inline -> SRP / service boundary -> moved the workflow into `warningService`.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.
- `npm run lint`: passed with the same pre-existing React hook dependency warnings recorded in the baseline.

## 2026-06-27 - Phase 3 Slice: Warning Resolve Boundary

Scope:

- Moved warning resolve authorization and transaction workflow into `src/server/services/warningService.ts`.
- Moved warning lookup/update/log persistence into `src/server/repositories/warningRepository.ts`.
- Reduced `/api/warnings/[id]/resolve` to controller responsibilities.

Smell -> principle -> fix:

- Resolve route mixed request delivery, authorization, persistence, and audit logging -> SRP / controller-service-repository boundary -> moved workflow and data access into server layers.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Warning Read/Acknowledge Boundary

Scope:

- Added `src/server/repositories/warningRepository.ts`.
- Added `src/server/services/warningService.ts` for unread-warning reads and acknowledge workflow.
- Migrated `/api/warnings`, `/api/warnings/unread`, and `/api/warnings/[id]/acknowledge` read/acknowledge flows to the service.
- Left warning creation and resolve flows for a later slice.

Smell -> principle -> fix:

- Warning routes repeated receipt queries and response shaping -> controller/service/repository boundary -> moved warning receipt access to a repository and workflow decisions to a service.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Notification Service Boundary

Scope:

- Added `src/server/repositories/notificationRepository.ts`.
- Added `src/server/services/notificationService.ts`.
- Reduced notification routes to session lookup, service call, and response shaping.

Smell -> principle -> fix:

- Notification API routes mixed delivery with Prisma access -> controller/service/repository boundary -> moved queries to a repository and workflow ownership checks to a service.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 1 Slice: Shared Formatters

Scope:

- Added shared currency and date formatters under `src/shared/formatters`.
- Replaced a first small set of finance and warning display formatting calls with the shared helpers.

Smell -> principle -> fix:

- Currency/date display rules were scattered across components -> shared leaf utilities -> introduced `formatSar`, `formatDate`, and `formatDateTime`.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with the same pre-existing React hook dependency warnings recorded in the baseline.

## 2026-06-27 - Phase 2/3 Slice: Session and Response Helpers

Scope:

- Added `src/server/auth/session.ts` as the server-side session helper home.
- Kept `src/lib/activeSessionUser.ts` as a compatibility re-export.
- Added `src/server/http/responses.ts` for common JSON response helpers.
- Migrated notifications GET/PATCH routes to the new helpers without changing response shapes.

Smell -> principle -> fix:

- API routes repeated `getServerSession` and `NextResponse.json` boilerplate -> controller thinness / SRP -> extracted reusable auth and response helpers.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.
