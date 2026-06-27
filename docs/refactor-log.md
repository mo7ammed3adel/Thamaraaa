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

## 2026-06-27 - Phase 3 Slice: Project Status Boundary

Scope:

- Moved project status update authorization, validation, blocker checks, audit logs, and account-manager backfill into `src/server/services/projectLifecycleService.ts`.
- Added project status repository helpers in `src/server/repositories/projectRepository.ts`.
- Reduced `/api/projects/[id]/status` to session lookup, request parsing, service dispatch, and response mapping.
- Left setup routes for a later slice before closing roadmap item R0324.

Smell -> principle -> fix:

- Project status route mixed delivery, authorization, workflow rules, Prisma writes, audit logs, and distribution side effects -> SRP / controller-service-repository boundary -> moved workflow decisions to the service and persistence calls to the repository.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Project Setup Boundary

Scope:

- Moved existing-project setup authorization, link validation, project updates, and setup logging into `src/server/services/projectLifecycleService.ts`.
- Moved project-from-deal recovery workflow into `projectLifecycleService`, while preserving duplicate-deal checks, sales-agent ownership checks, project log creation, and Head AM notifications.
- Added setup-focused repository helpers in `src/server/repositories/projectRepository.ts`.
- Reduced `/api/projects/[id]/setup` and `/api/projects/setup` to request/session handling and response mapping.
- Closed roadmap items R0311, R0324, and R0332.

Smell -> principle -> fix:

- Setup routes mixed controller code with authorization, URL sanitization, transaction orchestration, and notification side effects -> SRP / service-repository boundary -> moved decisions to service functions and Prisma calls into project repository helpers.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Project Assign Boundary

Scope:

- Added `src/server/services/projectDistributionService.ts` for project assignment workflows.
- Moved `/api/projects/[id]/assign` validation, distribution permission checks, project scope checks, assignment update, warning receipt backfill, and audit log creation into the service.
- Added a shared active-user assignment repository helper.
- Kept response messages and status codes aligned with the existing route.

Smell -> principle -> fix:

- The assign route mixed request handling, RBAC, project ownership checks, Prisma mutation, warning receipt side effect, and audit logging -> controller-service-repository boundary -> route now maps service results to the same HTTP contract.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Project Team Assignment Boundary

Scope:

- Moved `/api/projects/[id]/team-assignment` role, department, target-user, and project-scope checks into `projectDistributionService`.
- Moved replacement of active team-assignment slots, task reassignment, audit logging, and notification creation into `projectRepository`.
- Kept warning receipt backfill in the service after successful assignment.
- Preserved existing response messages/status codes and the transaction order of assignment cleanup, upsert, task update, log, and notification.

Smell -> principle -> fix:

- Team assignment route contained UI-facing request mapping plus department policy, project ownership, multi-table mutation, audit, and notification code -> SRP / domain service boundary -> route now maps a typed service result to HTTP.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Project Agent Assignment Boundary

Scope:

- Moved `/api/projects/[id]/assign-agent` leader authorization, department validation, target-agent validation, and project-management scope checks into `projectDistributionService`.
- Moved agent assignment replacement, task assignment update, audit log, and notification creation into `projectRepository`.
- Preserved warning receipt backfill and realtime trigger behavior after successful assignment.

Smell -> principle -> fix:

- Assign-agent route mixed request handling, leader RBAC, department/task config, project scope checks, multi-table writes, notifications, and realtime delivery -> SRP / service boundary -> route now maps service outcomes to the existing HTTP contract.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Project Distribution Boundary

Scope:

- Moved `/api/projects/distribute` target validation, distribution permission checks, project scope checks, manager/head assignment, team assignment, audit logging, warning receipt backfill, notification creation, realtime triggers, and auto task generation into `projectDistributionService` plus project repository helpers.
- Kept route-level request/session handling and HTTP response mapping only.
- Preserved the existing auto task generation URL/cookie behavior and response shapes for manager/head assignment and team assignment.
- Closed roadmap items R0323 and R0333.

Smell -> principle -> fix:

- General distribution route combined RBAC, project IDOR checks, role-to-department mapping, multi-table writes, notifications, realtime events, and route delivery -> SRP / service-repository boundary -> moved workflow and persistence into server domain layers.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.
- `npm run lint`: passed with the same pre-existing React hook dependency warnings recorded in the baseline.
- `npm run build`: passed.

## 2026-06-27 - Phase 3 Slice: Task Flag Boundary

Scope:

- Added `src/server/repositories/taskRepository.ts`.
- Added `src/server/services/taskWorkflowService.ts`.
- Moved `/api/tasks/[id]/flag` task lookup, assigned-agent permission check, reason validation, task update, notification, and project log creation into the service/repository boundary.
- Kept route response messages/status codes and error details unchanged.
- Closed roadmap item R0312.

Smell -> principle -> fix:

- Task flag route mixed request handling, ownership/IDOR check, mutation, notification, and audit logging -> controller-service-repository boundary -> moved workflow and persistence out of the route.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Task Reassign Boundary

Scope:

- Moved `/api/tasks/[id]/reassign` leader permission checks, task ownership checks, new-agent validation, task-type role validation, reassignment mutation, team-assignment upsert, notifications, warning receipt backfill, and audit log creation into `taskWorkflowService` and `taskRepository`.
- Kept response messages/status codes and error details unchanged.

Smell -> principle -> fix:

- Task reassign route mixed request delivery, role policy, task scope check, user lookup, mutation, notifications, and audit logging -> controller-service-repository boundary -> route now maps service outcomes to HTTP.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Self Task Boundary

Scope:

- Moved `/api/tasks/self` role checks, required-field validation, project access check, task creation, checklist selection, and project log creation into `taskWorkflowService` and `taskRepository`.
- Preserved the same self-task payload, default priority/status/progress values, and response messages/status codes.

Smell -> principle -> fix:

- Self-task route mixed request handling, role policy, project visibility, task creation, checklist selection, and audit logging -> controller-service-repository boundary -> route now only maps session/body and service outcomes.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Task List Boundary

Scope:

- Moved GET `/api/tasks` visibility filtering and task list query into `taskWorkflowService` and `taskRepository`.
- Preserved project-scoped IDOR check via `userCanAccessProject` and role-based task visibility for account/head/team users.
- Left POST `/api/tasks` for a separate slice.

Smell -> principle -> fix:

- Task list route mixed request query parsing, authorization scope construction, and Prisma query shape -> controller-service-repository boundary -> route now delegates visibility and persistence to server layers.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Task Create Boundary

Scope:

- Moved POST `/api/tasks` role checks, required-field validation, task link sanitization, project membership check, leader resolution, task creation, cross-team logging, notifications, and realtime triggers into `taskWorkflowService` and `taskRepository`.
- Preserved the existing leader fallback order and cross-team task side effects.

Smell -> principle -> fix:

- Task create route mixed request handling, project IDOR checks, leader discovery, persistence, notifications, and realtime events -> controller-service-repository boundary -> route now maps service outcomes to HTTP.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Task Update Boundary

Scope:

- Moved PATCH `/api/tasks/[id]` task authorization, agent/leader reassignment validation, progress validation, status validation, blocker checks, file normalization, task update, assignment notifications, progress rollup, review/done notifications, and project logs into `taskWorkflowService` and `taskRepository`.
- Kept route response messages/status codes and warning/file error shapes aligned with the existing API.

Smell -> principle -> fix:

- Task update route mixed controller delivery, IDOR checks, business validation, Prisma mutations, project progress aggregation, warning blockers, and notifications -> controller-service-repository boundary -> route now maps service outcomes to HTTP.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.
- `npm run lint`: passed with the same pre-existing React hook dependency warnings recorded in the baseline.

## 2026-06-27 - Phase 3 Slice: Task Generate Boundary

Scope:

- Moved POST `/api/tasks/generate` project access checks, sub-task generation, standard package task generation, leader resolution, duplicate task skipping, task creation, notification creation, project status update, and project log creation into `taskWorkflowService` and `taskRepository`.
- Preserved existing response shapes/status codes for sub-task creation, existing-task skips, missing leaders, and package mapping failures.
- Closed roadmap items R0322 and R0334.

Smell -> principle -> fix:

- Task generation route mixed request delivery, project IDOR checks, service/package parsing, leader lookup, task creation, notifications, and audit logging -> controller-service-repository boundary -> route now maps service outcomes to HTTP.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.
- `npm run lint`: passed with the same pre-existing React hook dependency warnings recorded in the baseline.
- `npm run build`: passed.

## 2026-06-27 - Phase 3 Slice: Finance Overview Boundary

Scope:

- Added `src/server/repositories/financeRepository.ts`.
- Added `src/server/services/financeService.ts`.
- Moved `/api/finance/overview` deal/installment queries and aggregate calculations into the finance service/repository boundary.
- Preserved accountant/super_admin authorization and response payload shape.
- Closed roadmap item R0316.

Smell -> principle -> fix:

- Finance overview route mixed authorization, Prisma reads, and aggregate calculations -> controller-service-repository boundary -> route now handles auth and maps the service payload.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Finance Commissions Boundary

Scope:

- Moved `/api/finance/commissions` commission listing, default month calculation, config loading, and recompute orchestration into `financeService` and `financeRepository`.
- Preserved finance role authorization, JSON validation, month validation, and error details.

Smell -> principle -> fix:

- Commissions route mixed finance auth, Prisma query, config loading, and recompute workflow orchestration -> controller-service-repository boundary -> route now maps finance service calls to HTTP.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Finance Commission Edit Boundary

Scope:

- Moved `/api/finance/commissions/[id]` commission lookup, finalized-lock validation, editable-field validation, bonus/deduction serialization, net payout recomputation, and update call into `financeService` and `financeRepository`.
- Preserved finance role authorization, JSON validation, response messages/status codes, and error logging.

Smell -> principle -> fix:

- Commission edit route mixed controller delivery, finance workflow validation, payout calculation, and Prisma mutation -> controller-service-repository boundary -> route now maps edit service outcomes to HTTP.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Finance Installment Boundary

Scope:

- Moved `/api/finance/installments/[id]` payment-state validation, installment lookup, update transaction, and project log creation into `financeService` and `financeRepository`.
- Preserved accountant/super_admin authorization and response messages/status codes.

Smell -> principle -> fix:

- Installment route mixed request handling, finance authorization, Prisma transaction, and project audit logging -> controller-service-repository boundary -> route now maps finance service outcomes to HTTP.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Finance Export Boundary

Scope:

- Moved `/api/finance/commissions/export` commission export query, row mapping, workbook creation, and default month calculation into `financeService` and `financeRepository`.
- Kept the route responsible for finance authorization and binary `NextResponse` headers.
- Closed roadmap items R0326 and R0335.

Smell -> principle -> fix:

- Export route mixed HTTP response construction with query and spreadsheet generation details -> service boundary -> route now only returns the service-built workbook buffer.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.
- `npm run lint`: passed with the same pre-existing React hook dependency warnings recorded in the baseline.
- `npm run build`: passed.

## 2026-06-27 - Phase 3 Slice: Project Lifecycle Boundary

Scope:

- Added `src/server/repositories/projectRepository.ts`.
- Added `src/server/services/projectLifecycleService.ts`.
- Reduced `/api/projects/lifecycle` to request parsing, service call, and response mapping.
- Left project status/setup routes for later slices.

Smell -> principle -> fix:

- Lifecycle route mixed state-machine policy, persistence, audit logging, and realtime notification -> service/repository boundary -> moved lifecycle workflow into `projectLifecycleService`.

Behavior preserved by:

- `npx tsc --noEmit`: passed.
- `npm test`: passed, 7 files and 30 tests.

## 2026-06-27 - Phase 3 Slice: Notes Service Boundary

Scope:

- Added `src/server/repositories/noteRepository.ts`.
- Added `src/server/services/notesService.ts`.
- Reduced `/api/notes` GET/POST to request parsing and response mapping.

Smell -> principle -> fix:

- Notes API route mixed authorization, query construction, pagination, and persistence -> service/repository boundary -> moved access checks and workflows into `notesService` and Prisma calls into `noteRepository`.

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
