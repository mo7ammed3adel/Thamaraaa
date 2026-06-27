# Code Refactor Roadmap Specification

**Project**: Thamaraa ERP / CRM  
**Created**: 2026-06-27  
**Status**: Draft for step-by-step execution  
**Purpose**: تنظيم كود النظام بدون تغيير أي وظيفة شغالة، بحيث يبقى قابل للتوسع لـ 500 مستخدم، أسهل في الصيانة، وأوضح لأي AI أو مطور يكمل بعدنا.

---

## 1. الهدف

نحتاج ريفاكتور تدريجي للكود الحالي، وليس إعادة كتابة. السلوك الحالي يعتبر ثابت:

- أي شاشة شغالة تفضل شغالة بنفس النتائج.
- أي API يرجع نفس البيانات ونفس حالات الخطأ.
- صلاحيات الأدوار وقيود IDOR تفضل كما هي أو يتم نقلها فقط لمكان مركزي بدون تغيير معناها.
- Sales و TeleSales متعلمين كأجزاء مكتملة وظيفياً؛ أي لمس لهم يكون متأخر جداً وبحذر، فقط لاستخراج shared types/API client أو تنظيف واضح مع تحقق بصري.

النتيجة المطلوبة: كل طبقة في مكانها:

- `src/app/**`: delivery layer فقط، صفحات و route handlers رفيعة.
- `src/server/services/**`: workflows/business logic.
- `src/server/repositories/**`: Prisma/data access.
- `src/server/policies/**`: role checks, ownership checks, resource visibility.
- `src/server/mappers/**`: تحويل Prisma records إلى DTOs آمنة للواجهة.
- `src/server/validators/**`: validation لمدخلات APIs.
- `src/contracts/**`: request/response DTOs والـ enums المشتركة بين الواجهة والباك.
- `src/client/transport/**`: HTTP mechanics.
- `src/client/api/**`: functions typed لكل endpoint.
- `src/client/state/**`: hooks/view-model logic.
- `src/components/**`: presentation/shared UI فقط قدر الإمكان.

---

## 2. الوضع الحالي المختصر

المشروع حالياً Next.js App Router + Prisma + PostgreSQL + NextAuth. الكود شغال، لكن فيه خلط طبيعي بين طبقات كثيرة بسبب سرعة التنفيذ.

### أكبر ملفات واجهة تحتاج تفكيك

- `src/app/dashboard/clients/[projectId]/ClientFullJourneyClient.tsx` حوالي 1145 سطر.
- `src/app/dashboard/sales/SalesClient.tsx` حوالي 1026 سطر. محمي وظيفياً ومؤجل.
- `src/app/dashboard/seo/SeoClient.tsx` حوالي 825 سطر.
- `src/app/dashboard/hr/HrClient.tsx` حوالي 785 سطر.
- `src/app/dashboard/media-buyer/MediaBuyerClient.tsx` حوالي 693 سطر.
- `src/app/dashboard/account-manager/AccountManagerClient.tsx` حوالي 689 سطر.
- `src/app/dashboard/social-media/SocialMediaClient.tsx` حوالي 630 سطر.
- `src/app/dashboard/telesales/TeleSalesClient.tsx` حوالي 623 سطر. محمي وظيفياً ومؤجل.

### أكبر API routes تحتاج فصل controller/service/repository

- `src/app/api/tasks/[id]/route.ts` حوالي 305 سطر.
- `src/app/api/tasks/generate/route.ts` حوالي 273 سطر.
- `src/app/api/leads/import/route.ts` حوالي 236 سطر.
- `src/app/api/projects/distribute/route.ts` حوالي 222 سطر.
- `src/app/api/leads/[id]/route.ts` حوالي 215 سطر.
- `src/app/api/projects/[id]/assign-agent/route.ts` حوالي 209 سطر.
- `src/app/api/tasks/route.ts` حوالي 199 سطر.
- `src/app/api/warnings/route.ts` حوالي 188 سطر.

### روائح تنظيمية يجب علاجها تدريجياً

- route handlers تحتوي auth + validation + Prisma + business rules + notifications في نفس الملف.
- client components تحتوي fetch مباشر، state، filtering، rendering، و business decisions في نفس الملف.
- استخدام واسع لـ `any` في components و API routes.
- JSON columns مثل checklist/files/bonuses/deductions/performanceHistory يتم parsing لها في أماكن متعددة.
- صلاحيات الأدوار موزعة بين route handlers و helpers، وتحتاج policy layer موحد.
- DTOs غير موحدة بين server pages و client components، فيصعب معرفة شكل البيانات الفعلي.

---

## 3. قواعد التنفيذ الصارمة

هذه القواعد تنطبق على كل خطوة ريفاكتور:

- خطوة واحدة صغيرة ثم تحقق ثم commit.
- ممنوع تغيير behavior داخل commit اسمه refactor.
- لو ظهر bug أو security issue أثناء الريفاكتور، يتسجل كـ separate fix ولا يدخل وسط refactor commit.
- قبل لمس أي شاشة Sales/TeleSales، لازم يكون عندنا API/client contract مستقر + تحقق بصري أو manual smoke.
- لا يتم حذف كود قديم إلا بعد أن يكون كل caller اتحول للمكان الجديد.
- لا يتم إدخال abstraction إلا لو سيزيل تكرار حقيقي أو يفصل policy/detail boundary واضح.

### بوابة التحقق القياسية

بعد كل مرحلة رئيسية:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

لو المرحلة صغيرة جداً، نبدأ بـ `npx tsc --noEmit` ثم الاختبار الأقرب، لكن قبل غلق المرحلة لازم كل الأوامر أعلاه تمر أو يتم توثيق سبب عدم تشغيلها.

---

## 4. الخطة التنفيذية

## Phase 0: Baseline & Safety Rails

**الهدف**: نثبت نقطة البداية ونحدد أوامر التحقق قبل أي نقل ملفات.

- [x] R0001 تشغيل `git status --short --branch` والتأكد من عدم وجود تغييرات غير مفهومة.
- [x] R0002 تشغيل `npx tsc --noEmit` وتسجيل النتيجة.
- [x] R0003 تشغيل `npm run lint` وتسجيل التحذيرات الموجودة مسبقاً.
- [x] R0004 تشغيل `npm test` وتسجيل الاختبارات الموجودة.
- [x] R0005 تشغيل `npm run build` وتسجيل أي مشاكل بيئة مثل قفل `.next/trace`.
- [x] R0006 إنشاء `docs/refactor-log.md` أو تحديث هذا الملف بنتائج baseline قبل بدء التنفيذ.

**لا ننتقل للمرحلة التالية إلا إذا**: عرفنا حالة المشروع الحالية، وما فيش فشل مجهول في typecheck/test/build.

---

## Phase 1: Contracts, Types, and Safe Parsers

**الهدف**: تقليل `any` و JSON parsing العشوائي قبل نقل منطق كبير.

### 1.1 Shared contracts

- [x] R0101 إنشاء `src/contracts/roles.ts` وفيه `UserRole` union مبني على الأدوار الحالية.
- [x] R0102 إنشاء `src/contracts/project.ts` وفيه DTOs للـ project/client journey.
- [x] R0103 إنشاء `src/contracts/task.ts` وفيه DTOs للمهام والـ checklist والـ task status.
- [x] R0104 إنشاء `src/contracts/warning.ts` وفيه DTOs للتحذيرات والـ receipts.
- [x] R0105 إنشاء `src/contracts/finance.ts` وفيه DTOs للعمولات والأقساط والمبالغ.
- [ ] R0106 نقل الثوابت المشتركة من `src/lib/constants.ts` تدريجياً أو إعادة تصديرها بدون كسر imports القديمة.

### 1.2 Safe JSON parsers

- [x] R0110 إنشاء `src/server/parsers/json.ts` لدوال safe parse عامة.
- [ ] R0111 إنشاء parser typed للـ task checklist بدلاً من تكرار `JSON.parse` في `TaskWorkspaceModal` و `ProjectLogsPanel` و routes.
- [x] R0112 إنشاء parser typed للـ task files/deliverables.
- [x] R0113 إنشاء parser typed للـ commission bonuses/deductions.
- [x] R0114 إنشاء parser typed للـ HR performance history.
- [x] R0115 استبدال parsing في `src/lib/commissions.ts` بدون تغيير الناتج.

### 1.3 Formatting utilities

- [x] R0120 إنشاء `src/shared/formatters/currency.ts` واستخدام `SAR` من مكان واحد.
- [x] R0121 إنشاء `src/shared/formatters/date.ts` للتواريخ المعروضة.
- [ ] R0122 توحيد formatting في finance/sales analytics/dashboard cards بدون تغيير النصوص الظاهرة إلا العملة المطلوبة.

**لا ننتقل للمرحلة التالية إلا إذا**: كل parser عليه استخدام فعلي، ولا يوجد تغيير في شكل البيانات الراجعة، و`npx tsc --noEmit` يمر.

---

## Phase 2: Central Auth, RBAC, and Resource Policies

**الهدف**: تجميع الصلاحيات وقيود IDOR في policy layer واضح.

### 2.1 Session helpers

- [x] R0201 مراجعة `src/lib/activeSessionUser.ts` وتحويله إلى `src/server/auth/session.ts` أو إعادة تصديره من المكان الجديد.
- [ ] R0202 إنشاء `requireUser()` للـ API routes يرجع user typed أو يرمي unauthorized response helper.
- [ ] R0203 إنشاء `requireRole(user, allowedRoles)` بدون تغيير الصلاحيات الحالية.

### 2.2 Resource policies

- [ ] R0210 إنشاء `src/server/policies/projectPolicy.ts`.
- [ ] R0211 نقل project visibility من routes/pages إلى policy functions.
- [ ] R0212 إنشاء `src/server/policies/taskPolicy.ts`.
- [ ] R0213 نقل can assign/reassign/flag/update task من routes إلى policy layer.
- [ ] R0214 إنشاء `src/server/policies/leadPolicy.ts`.
- [ ] R0215 إنشاء `src/server/policies/warningPolicy.ts`.
- [ ] R0216 إنشاء `src/server/policies/userManagementPolicy.ts`.

### 2.3 IDOR regression checklist

- [ ] R0220 لكل route يأخذ `id` من URL، التأكد أن policy تفحص ownership/scope قبل update/delete.
- [ ] R0221 توثيق route matrix: role -> resource -> allowed action.
- [ ] R0222 تشغيل manual/API smoke على users من أدوار مختلفة للتأكد أن user لا يرى حساب أو مشروع خارج نطاقه.

**لا ننتقل للمرحلة التالية إلا إذا**: كل route معدل يستدعي policy واضحة قبل أي mutation، والاختبارات الحالية تمر.

---

## Phase 3: Backend Layer Split

**الهدف**: تخفيف route handlers. الـ route يكون: parse input -> call service -> return response.

### 3.1 Shared response and validation helpers

- [x] R0301 إنشاء `src/server/http/responses.ts` لتوحيد JSON success/error responses.
- [ ] R0302 إنشاء `src/server/http/request.ts` لدوال قراءة body/query params بأمان.
- [ ] R0303 إنشاء validators بدون مكتبة جديدة حالياً، أو استخدام دوال typed بسيطة.

### 3.2 Repositories

- [ ] R0310 إنشاء `src/server/repositories/userRepository.ts`.
- [ ] R0311 إنشاء `src/server/repositories/projectRepository.ts`.
- [ ] R0312 إنشاء `src/server/repositories/taskRepository.ts`.
- [ ] R0313 إنشاء `src/server/repositories/warningRepository.ts`.
- [ ] R0314 إنشاء `src/server/repositories/leadRepository.ts`.
- [ ] R0315 إنشاء `src/server/repositories/dealRepository.ts`.
- [ ] R0316 إنشاء `src/server/repositories/financeRepository.ts`.
- [ ] R0317 إنشاء `src/server/repositories/hrRepository.ts`.

### 3.3 Services by domain

- [ ] R0320 إنشاء `src/server/services/warningService.ts` ونقل create/list/ack/resolve warning flows.
- [ ] R0321 إنشاء `src/server/services/notificationService.ts` ونقل create/createMany/email fallback logic.
- [ ] R0322 إنشاء `src/server/services/taskWorkflowService.ts` ونقل update/reassign/flag/generate task flows.
- [ ] R0323 إنشاء `src/server/services/projectDistributionService.ts` ونقل project distribute/assign-agent/team-assignment flows.
- [ ] R0324 إنشاء `src/server/services/projectLifecycleService.ts` ونقل lifecycle/status/setup flows.
- [ ] R0325 إنشاء `src/server/services/notesService.ts` ونقل notes list/create.
- [ ] R0326 إنشاء `src/server/services/financeService.ts` حول overview/installments/commissions.
- [ ] R0327 إنشاء `src/server/services/hrService.ts` حول employees/attendance/documents/evaluations.
- [ ] R0328 إنشاء `src/server/services/analyticsService.ts` لتجميع analytics queries المتكررة.

### 3.4 Route clusters order

يتم العمل بالترتيب التالي لتقليل المخاطرة:

- [ ] R0330 Warnings & notifications routes.
- [ ] R0331 Notes routes.
- [ ] R0332 Project lifecycle/setup/status routes.
- [ ] R0333 Project distribution/team assignment/assign-agent routes.
- [ ] R0334 Task routes.
- [ ] R0335 Finance routes.
- [ ] R0336 HR routes.
- [ ] R0337 Analytics routes.
- [ ] R0338 Leads/deals routes بعد تثبيت كل ما سبق.
- [ ] R0339 Sales/TeleSales touched only through shared service calls, no UI rewrite.

**لا ننتقل من cluster للتالي إلا إذا**: route files أصبحت رفيعة، نفس API contract محفوظ، وtypecheck/test/build أو narrow tests تمر.

---

## Phase 4: Client Transport and Typed API Client

**الهدف**: إلغاء `fetch` المباشر من الشاشات تدريجياً، ونقل HTTP details إلى طبقة واحدة.

### 4.1 Transport

- [ ] R0401 إنشاء `src/client/transport/http.ts` فيه `getJson`, `postJson`, `patchJson`, `deleteJson`.
- [ ] R0402 توحيد error handling للـ non-2xx responses.
- [ ] R0403 دعم query params helper.

### 4.2 Domain API modules

- [ ] R0410 إنشاء `src/client/api/warnings.ts`.
- [ ] R0411 إنشاء `src/client/api/notifications.ts`.
- [ ] R0412 إنشاء `src/client/api/notes.ts`.
- [ ] R0413 إنشاء `src/client/api/projects.ts`.
- [ ] R0414 إنشاء `src/client/api/tasks.ts`.
- [ ] R0415 إنشاء `src/client/api/finance.ts`.
- [ ] R0416 إنشاء `src/client/api/hr.ts`.
- [ ] R0417 إنشاء `src/client/api/users.ts`.
- [ ] R0418 إنشاء `src/client/api/leads.ts`.
- [ ] R0419 إنشاء `src/client/api/analytics.ts`.

### 4.3 Replacement order

- [ ] R0420 Replace fetch in shared components: `NotificationBell`, `NotesPanel`, `WarningPopup`, `GlobalWarningAlert`.
- [ ] R0421 Replace fetch in operations components: `TaskWorkspaceModal`, `TaskAssignmentForm`, `TaskReassignModal`, `TaskFlagModal`, `DistributeModal`.
- [ ] R0422 Replace fetch in finance dashboard.
- [ ] R0423 Replace fetch in HR dashboard.
- [ ] R0424 Replace fetch in account/technical/SEO/social/media/design dashboards.
- [ ] R0425 Replace fetch in Sales/TeleSales only after smoke test baseline.

**لا ننتقل للمرحلة التالية إلا إذا**: كل شاشة تم تعديلها لا تحتوي fetch مباشر لنفس الدومين، وerrors ما زالت تظهر بنفس الشكل أو بشكل متوافق.

---

## Phase 5: Frontend State and Component Decomposition

**الهدف**: تفكيك الشاشات الكبيرة إلى view-model hooks + components صغيرة بدون تغيير UI أو functionality.

### 5.1 Shared UI primitives

- [ ] R0501 إنشاء component موحد لـ KPI cards مع نفس نمط `Sales Team Analytics`.
- [ ] R0502 إنشاء component موحد لـ dashboard filters.
- [ ] R0503 إنشاء component موحد لـ empty states.
- [ ] R0504 إنشاء component موحد لـ status badges.
- [ ] R0505 إنشاء component موحد لـ modal shell.

### 5.2 Client journey page

- [ ] R0510 استخراج timeline builder من `ClientFullJourneyClient.tsx` إلى pure helper.
- [ ] R0511 استخراج `ClientTimelineTab`.
- [ ] R0512 استخراج `ClientTasksTab`.
- [ ] R0513 استخراج `ClientTeamTab`.
- [ ] R0514 استخراج `ClientWarningsTab`.
- [ ] R0515 استخراج `ClientNotesTab`.
- [ ] R0516 استخراج `ClientFilesTab`.
- [ ] R0517 تقليل `ClientFullJourneyClient.tsx` إلى orchestrator لا يتخطى 250-300 سطر.

### 5.3 Operations dashboards

- [ ] R0520 تفكيك `AccountManagerClient.tsx` إلى hooks/components.
- [ ] R0521 تفكيك `HeadAccountManagerClient.tsx`.
- [ ] R0522 تفكيك `HeadTechnicalClient.tsx`.
- [ ] R0523 تفكيك `SeoClient.tsx`.
- [ ] R0524 تفكيك `SocialMediaClient.tsx`.
- [ ] R0525 تفكيك `MediaBuyerClient.tsx`.
- [ ] R0526 تفكيك `DesignClient.tsx`.

### 5.4 HR and Finance

- [ ] R0530 تفكيك `HrClient.tsx` إلى attendance/employees/promotion/documents tabs.
- [ ] R0531 تفكيك `FinanceClient.tsx` إلى overview/installments/commissions/settings sections.

### 5.5 Protected Sales and TeleSales

- [ ] R0540 إنشاء visual/manual baseline لـ Sales dashboard.
- [ ] R0541 إنشاء visual/manual baseline لـ TeleSales dashboard.
- [ ] R0542 استخراج shared API calls فقط، بدون إعادة تصميم.
- [ ] R0543 استخراج pure calculations إن وجدت، مع characterization test لو لا يغطيها TypeScript.
- [ ] R0544 عدم تغيير layout أو workflow إلا بطلب مستقل.

**لا ننتقل للمرحلة التالية إلا إذا**: كل component مستخرج له props typed، ولا يوجد `any` جديد، والشاشة تظهر نفس البيانات.

---

## Phase 6: Server Pages Data Loaders

**الهدف**: فصل Prisma من server pages إلى data loaders/read services مع الحفاظ على Server Component pattern.

- [ ] R0601 إنشاء `src/server/loaders/dashboardLoaders.ts` للـ dashboard home/profile/common counts.
- [ ] R0602 إنشاء `src/server/loaders/projectPageLoaders.ts`.
- [ ] R0603 إنشاء `src/server/loaders/teamDashboardLoaders.ts`.
- [ ] R0604 إنشاء `src/server/loaders/salesLoaders.ts` مؤجل ومحمي.
- [ ] R0605 إنشاء `src/server/loaders/telesalesLoaders.ts` مؤجل ومحمي.
- [ ] R0606 استبدال Prisma المباشر في pages غير الحساسة أولاً: warnings, settings, profile, operations packages.
- [ ] R0607 استبدال Prisma المباشر في operations dashboards.
- [ ] R0608 استبدال Prisma المباشر في Sales/TeleSales فقط بعد baseline.

**لا ننتقل للمرحلة التالية إلا إذا**: server page لا تحتوي business filtering معقد، والloader typed ومحدود المسؤولية.

---

## Phase 7: Analytics and Aggregation Cleanup

**الهدف**: توحيد منطق التحليلات والتواريخ والتجميعات.

- [ ] R0701 إنشاء `src/server/services/analytics/dateRange.ts`.
- [ ] R0702 توحيد date filters بين telesales/sales/team analytics.
- [ ] R0703 استخراج team analytics aggregations في service واحدة.
- [ ] R0704 استخراج drill-down builders.
- [ ] R0705 توحيد revenue/currency calculations على SAR.
- [ ] R0706 مراجعة performance للqueries مع 500 مستخدم وبيانات كثيرة.

**لا ننتقل للمرحلة التالية إلا إذا**: أرقام التحليلات قبل وبعد متطابقة على نفس قاعدة البيانات.

---

## Phase 8: Performance and Data Access Hygiene

**الهدف**: تحسين الشكل والتنظيم بدون تغيير النتائج.

- [ ] R0801 مراجعة `include` الضخمة واستبدالها بـ `select` حيث لا نحتاج كل الحقول.
- [ ] R0802 إضافة pagination أو limits فقط في الأماكن التي تقرها الوظيفة الحالية أو مع feature decision مستقل.
- [ ] R0803 تشغيل queries المستقلة بـ `Promise.all` داخل services حيث لا يوجد dependency.
- [ ] R0804 منع N+1 queries في client journey/team dashboards.
- [ ] R0805 مراجعة indexes المطلوبة في Prisma، وأي schema change يكون migration مستقل وليس refactor مخفي.
- [ ] R0806 توثيق dashboard load budgets: target أقل من 3 ثواني للصفحات الأساسية.

**لا ننتقل للمرحلة التالية إلا إذا**: لا يوجد تغير في البيانات الراجعة، وأي migration منفصل ومسبب.

---

## Phase 9: Naming and Role Consistency

**الهدف**: أسماء أوضح بدون كسر البيانات.

- [ ] R0901 تعريف `UserRole` يطابق القيم الحالية كما هي في DB.
- [ ] R0902 عدم تغيير role strings في قاعدة البيانات داخل الريفاكتور.
- [ ] R0903 توحيد أسماء display labels للأدوار في helper واحد.
- [ ] R0904 رصد أي typos تاريخية في الأدوار وتوثيقها، لكن migration لتصحيحها يكون قرار مستقل.
- [ ] R0905 استبدال أسماء عامة مثل `data`, `items`, `handleSubmit` داخل الملفات المفككة بأسماء domain واضحة.

**لا ننتقل للمرحلة التالية إلا إذا**: كل rename type-aware أو محدود وواضح، ولا يكسر stored role values.

---

## Phase 10: Final Hardening and Documentation

**الهدف**: غلق الريفاكتور بشكل يمكن الاعتماد عليه.

- [ ] R1001 تحديث `README.md` أو إضافة `docs/architecture.md` يشرح الطبقات الجديدة.
- [ ] R1002 توثيق how to add new API route بالطريقة الجديدة.
- [ ] R1003 توثيق how to add new dashboard action بالطريقة الجديدة.
- [ ] R1004 توثيق role policy matrix.
- [ ] R1005 تشغيل validation كامل: typecheck, lint, test, build.
- [ ] R1006 تشغيل smoke يدوي للأدوار الأساسية:
  - super_admin
  - head_account_manager
  - account_manager
  - head_technical
  - head_seo
  - team leaders
  - agents
  - hr_manager
  - accountant
  - sales_agent/sales_manager
  - tele_sales_agent/tele_sales_manager
- [ ] R1007 مراجعة diff النهائي كأننا reviewer: هل السلوك اتغير؟ هل abstractions زادت بدون داعي؟ هل في dead code؟

---

## 5. ترتيب الأولوية المقترح

الأولوية العملية:

1. Phase 0 baseline.
2. Phase 1 contracts/parsers.
3. Phase 2 policies/security centralization.
4. Phase 3 backend split لأول clusters: warnings, notes, projects, tasks.
5. Phase 4 typed API client.
6. Phase 5 تفكيك Client Journey ثم operations dashboards.
7. HR/Finance.
8. Analytics.
9. Sales/TeleSales protected cleanup في الآخر.

سبب الترتيب: نقل الصلاحيات والعقود قبل تفكيك الشاشات يقلل خطر IDOR أو كسر workflows، وتفكيك operations قبل Sales/TeleSales يحافظ على الأجزاء التي قلت إنها شغالة بالكامل.

---

## 6. Definition of Done لكل خطوة

أي task من هذا الملف لا يعتبر Done إلا إذا:

- السلوك الظاهر لم يتغير.
- لا توجد أخطاء TypeScript جديدة.
- لا توجد lint errors جديدة.
- إن كان التغيير يمس API: تم التأكد من status codes والresponse shape.
- إن كان التغيير يمس شاشة: تم فتح الشاشة أو إجراء smoke مناسب.
- تم حذف الكود القديم بعد تحويل callers، أو توثيق سبب إبقائه مؤقتاً.
- تم عمل commit مستقل باسم واضح مثل:

```text
refactor(tasks): move update workflow into task service
refactor(warnings): centralize warning policy checks
refactor(client-api): route notes calls through typed api client
```

---

## 7. أشياء ممنوع خلطها مع الريفاكتور

- إضافة feature جديدة.
- تغيير تصميم UI إلا لو مطلوب لتفكيك component مع الحفاظ على الشكل.
- تغيير صلاحيات role بدون طلب واضح.
- تغيير DB schema لتصحيح أسماء أو تحسينات إلا في commit منفصل وقرار مستقل.
- إصلاح security bug داخل commit refactor. يتم عمل `fix(security): ...` منفصل.
- ترقية Next.js أو dependencies الكبرى داخل نفس مسار الريفاكتور.

---

## 8. أول حزمة تنفيذ مقترحة

عند بدء التنفيذ الفعلي، نبدأ بالحزمة التالية فقط:

- [ ] تشغيل baseline commands.
- [ ] إنشاء `src/contracts/roles.ts`.
- [ ] إنشاء role display helper.
- [ ] إنشاء safe JSON parser عام.
- [ ] نقل parsing صغير واحد من `src/lib/commissions.ts` كتجربة.
- [ ] تشغيل `npx tsc --noEmit` و`npm test`.
- [ ] commit مستقل.

بعدها نقرر الحزمة التالية بناءً على النتيجة، وليس قبلها.
