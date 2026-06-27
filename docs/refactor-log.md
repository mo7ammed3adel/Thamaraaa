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
