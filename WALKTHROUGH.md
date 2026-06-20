# Thamaraa CRM — دليل المسير الكامل

> دليل تفصيلي لكل دور في النظام: المدخلات اللي بيشوفها، العمليات اللي يقدر ينفذها، والمخرجات اللي بتطلع منه.

---

## 0. الملخص التنفيذي

**ايه ده؟** نظام CRM/ERP لوكالة تسويق رقمي. بيمشي العميل من lead عند Tele-Sales، يتقفل deal مع Sales، يتحول لـproject عند Account Manager، يتوزع على فرق Operations، وينتهي بـpayouts للموظفين عن طريق المحاسب.

**الـStack**: Next.js 14 + TypeScript + Prisma + Postgres + NextAuth + Pusher (real-time) + Tailwind.

**عدد الأدوار**: 24 دور مقسومين على 6 مجموعات (Sales / Account Mgmt / Technical / Operations / HR / Finance) + super_admin.

**إجمالي API routes**: ~65 endpoint تحت `src/app/api/`.

**إجمالي Dashboards**: ~25 صفحة تحت `src/app/dashboard/`.

---

## 1. الفكرة الأساسية — التدفق الكامل للعميل

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  Lead (cold/warm/hot)                                                    │
│      │                                                                   │
│      ▼                                                                   │
│  Tele-Sales Agent ──── Call Logging ──── Meeting Scheduled               │
│      │                                                                   │
│      ▼                                                                   │
│  Auto-Assignment ──> Sales Agent (matched by specialization + level)     │
│      │                                                                   │
│      ▼                                                                   │
│  Sales Agent ──── Meeting ──── Feedback Form ──── Deal Closing Form      │
│      │                                                                   │
│      │ (Closed_Won)                                                      │
│      ▼                                                                   │
│  Project (auto-created from Deal)                                        │
│      │                                                                   │
│      ▼                                                                   │
│  Head Account Manager ──── distribute ──┬──> Account Manager             │
│                                          ├──> Head Technical             │
│                                          └──> Head SEO                   │
│                                                                          │
│  Account Manager ──── Setup (Niche / Deadline / URLs)                    │
│      │                                                                   │
│      └──── distribute ──> Head SEO                                       │
│                                                                          │
│  Head Technical ──── distribute ──┬──> TL Social Media                   │
│                                    └──> TL Media Buyer                   │
│                                                                          │
│  Head SEO ──── distribute ──> TL SEO                                     │
│                                                                          │
│  Team Leaders ──── distribute ──> Agents                                 │
│                                                                          │
│  Agents (Social / Media / SEO) ──── execute tasks ───────────────┐       │
│                                                                  │       │
│       │ (cross-team task creation)                              ▼       │
│       └──> Graphic / Motion / UI Leaders ──> their Agents               │
│                                                                          │
│  Progress propagates back to Account Manager (read-only journey)         │
│                                                                          │
│  Accountant ──── computes Commissions per agent per month                │
│                  (Cash×1.0 + Tabby/Tamara×0.93) → tier brackets          │
│                                                                          │
│  HR Manager ──── runs Promotion Engine + Hiring + Leave + Documents      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### الأنظمة المتقاطعة (cross-cutting)

- **Warning System**: أي AM/Sales يضغط زرار "Warning" على عميل → blocking popup يظهر لكل الفريق المرتبط بالـproject لحد ما يضغطوا "Acknowledge".
- **Client Journey Timeline**: timeline موحد بيظهر كل الأحداث — call logs + meetings + deal + tasks + notes + warnings + payments — مرتب زمنياً.
- **Notifications + Pusher**: real-time push لكل user على قناته (`user-${userId}`).

---

## 2. الـRoles من 24 دور

كل role له dashboard مخصص أو tab. الجدول السريع:

| الدور | Dashboard | الفئة | حالة التنفيذ |
|---|---|---|---|
| `super_admin` | Users + Settings + Master Sheet | Administration | ✅ |
| `chief_sales` | `/chief-sales` + `/chief-sales/pipeline` | Sales Leadership | ✅ |
| `tele_sales_manager` | `/telesales/*` (frozen) | Tele-Sales | ✅ |
| `tele_sales_agent` | `/telesales/*` (frozen) | Tele-Sales | ✅ |
| `sales_manager` | `/sales/*` (frozen) | Sales | ✅ |
| `sales_agent` | `/sales/*` (frozen) | Sales | ✅ |
| `head_account_manager` | `/head-account-manager` | Account Mgmt | ✅ |
| `account_manager` | `/account-manager` | Account Mgmt | ✅ |
| `head_technical` | `/head-technical` | Technical | ✅ |
| `head_seo` | `/seo` (head view) | SEO | ✅ |
| `team_leader_seo` | `/seo` (TL view) | SEO | ✅ |
| `agent_seo` | `/seo` (agent view) | SEO | ✅ |
| `agent_content_seo` | `/seo` (agent view) | SEO | ✅ |
| `team_leader_social_media` | `/social-media` | Social Media | ✅ |
| `agent_social_media` | `/social-media` | Social Media | ✅ |
| `team_leader_media_buyer` | `/media-buyer` | Media Buying | ✅ |
| `agent_media_buyer` | `/media-buyer` | Media Buying | ✅ |
| `leader_graphic_designer` | `/design?team=graphic` | Design | ✅ |
| `agent_graphic_designer` | `/design?team=graphic` | Design | ✅ |
| `leader_motion_graphic` | `/design?team=motion` | Design | ✅ |
| `agent_motion_graphic` | `/design?team=motion` | Design | ✅ |
| `leader_ui` | `/design?team=ui` | Design | ✅ |
| `agent_ui` | `/design?team=ui` | Design | ✅ |
| `hr_manager` | `/hr` (4 tabs) + `/hr/hiring` + `/hr/requests` | HR | ✅ |
| `accountant` | `/finance` (3 tabs) | Finance | ✅ |

---

## 3. تفاصيل كل دور — Inputs / Operations / Outputs

> **تنبيه**: TeleSales (`tele_sales_*`) و Sales (`sales_*`) **مجمدين** — موصوفين هنا للسياق فقط، لكن الكود ما يتعدلش فيهم.

---

### 3.1 super_admin

**المهمة**: إدارة كاملة للنظام — إنشاء/تعديل users، تكوين القواعد المالية، الاطلاع على master sheet، توزيع أي مشروع لأي دور.

**الـSidebar Items**:
- Dashboard Home
- Users (CRUD)
- System Config
- Global Master Sheet
- Notifications, Profile
- + كل items الأدوار التانية (لإن super_admin بيـoverride صلاحيات الكل)

#### المدخلات (ما يشاهده):
- **Users page** ([users/page.tsx](src/app/dashboard/users/page.tsx)): جدول كل الموظفين مع الـrole, level, status, createdAt.
- **Settings page** ([settings/page.tsx](src/app/dashboard/settings/page.tsx)) — 4 tabs:
  1. **💵 Finance Rules**: Net Target Formula, Gateway Fee % editor, Commission Tier Brackets table + JSON editor.
  2. **🧮 Commission Rules**: per-role flat percentage rules.
  3. **⚙️ System Config**: generic key/value store (e.g. `gateway_fee_pct`, `commission_tiers`).
  4. **🔐 Permission Matrix**: read-only role × capabilities reference.
- **Master Sheet** ([master-sheet/page.tsx](src/app/dashboard/master-sheet/page.tsx)): كل lifecycle الـleads → deals → projects.

#### العمليات اللي يقدر ينفذها:
- `POST /api/users` — إنشاء موظف (مع password hashing)
- `PATCH /api/users/[id]` — تعديل بيانات موظف
- `PATCH /api/users/[id]/status` — تعطيل/تفعيل الحساب
- `PATCH /api/users/[id]/specialization` — تعديل specialization (Hot/Warm/Cold)
- `PATCH /api/users/[id]/target` — تعديل monthly target
- `POST /api/settings` — تعديل أي system config (e.g. gateway fee, tiers JSON)
- `POST /api/settings/commissions` — تعديل أي commission rule per role
- override أي operation موجودة في الأدوار التانية (هو دايماً مدرج في الـauthz allow-lists)

#### المخرجات:
- DB writes: User table, SystemConfig, CommissionRule
- Notifications للمستخدمين الجداد
- Audit logs غير صريحة (مفيش `AdminLog` model — ده gap واضح)

---

### 3.2 chief_sales

**المهمة**: Executive view على pipeline الـSales (TeleSales + Sales) — KPIs مجمعة + drill-down على الموظفين.

**الـSidebar Items**:
- Sales Overview (`/chief-sales`)
- Pipeline (`/chief-sales/pipeline`)
- Deals (الجدول الموحد)

#### المدخلات (ما يشاهده):
**[ChiefSalesClient.tsx](src/app/dashboard/chief-sales/ChiefSalesClient.tsx)**:

- **Date Range Filter**: Today / This Week / This Month / All Time
- **KPI Cards** (كل واحدة كليكها بيفتح drill-down):
  - Total Revenue + Net Target
  - Collected Payments
  - Conversion Volume
  - Meetings Booked
- **TeleSales Team Leaderboard**: per agent — meetingsBooked, attended, lost, conversion rate
- **Sales Team Leaderboard**: per agent — dealsClosed, revenueGenerated, avgDealSize, closing rate
- **Recent Deals Table**: client / agent / package / amount / status
- **Warnings Section**: تنبيهات مفتوحة على عملاء (لو أي)

#### العمليات:
- `GET /api/analytics/chief-sales?range=...` — يجيب الـoverview المجمع
- فتح drill-down modal على أي KPI لرؤية الـrows الفعلية
- مفيش mutations — view-only role

#### المخرجات:
- صفر DB writes (read-only)
- يقدر يـexport بصرياً (لكن مفيش زرار XLSX export في الـchief-sales view حالياً — gap لتطوير لاحق)

---

### 3.3 head_account_manager

**المهمة**: مدير حسابات أعلى — يستقبل المشاريع المغلقة جديداً، يوزعها على Account Managers، يراقب الـpipeline ككل.

**الـSidebar Items**:
- All Projects (`/head-account-manager`)
- Projects & Tasks (`/operations`)
- Packages & Settings (`/operations/packages`)

#### المدخلات (ما يشاهده):
**[head-account-manager/page.tsx](src/app/dashboard/head-account-manager/page.tsx)** — يفـetch **كل** الـprojects:

- **KPI Cards**:
  - Total Projects
  - New Today
  - Active (statuses: in_progress / setup / new / assigned)
  - Delayed
  - Completed
  - Unassigned (مفيش accountManagerId)
  - Clients with Warnings
  - Avg Completion %
  - Onboarding (lifecycleState=Onboarding)
  - Active lifecycle
  - Churn risk (On_Hold + Churned)
- **Account Managers Workload** cards — لكل AM: عدد المشاريع، delays، avg progress
- **Master Clients List** — كل المشاريع مع filters: AM / status / lifecycleState / delay
- لكل project يقدر يفتح **Client Detail Modal** بيعرض client journey timeline

#### العمليات:
- `POST /api/projects/distribute` — يوزع project لـ`account_manager` / `head_technical` / `head_seo` (per `DISTRIBUTION_MAP`)
- `POST /api/projects/[id]/assign` — assign AM/HT/HSEO directly
- `POST /api/projects/[id]/reassign-am` — تغيير AM المسؤول
- `PATCH /api/projects/lifecycle` — تغيير lifecycleState (Onboarding → Active → On_Hold → Completed → Churned)
- `POST /api/warnings` — إصدار تحذير على عميل
- يقدر يفتح [DistributeModal](src/components/DistributeModal.tsx) و [ClientReassignModal](src/components/ClientReassignModal.tsx) و [CreateWarningModal](src/components/CreateWarningModal.tsx)

#### المخرجات:
- DB: Project.accountManagerId / headTechnicalId / headSeoId, TeamAssignment, Warning + WarningReceipt, ProjectLog
- Notifications للـAM/HT/HSEO المعيّن
- Pusher event: `team-assigned` على `projects-channel`
- audit log: ProjectLog entry لكل assignment

---

### 3.4 account_manager

**المهمة**: مدير حسابات على مجموعة عملاء معينة — يـsetup project، يوزع على Head SEO، يتابع تقدم الفرق، يصدر warnings.

**الـSidebar Items**:
- My Clients (`/account-manager`)
- Projects & Tasks (`/operations`)
- Packages & Settings

#### المدخلات (ما يشاهده):
**[account-manager/page.tsx](src/app/dashboard/account-manager/page.tsx)** — يفـetch فقط `where: { accountManagerId: user.id }`:

- **KPI Cards**:
  - Active Clients
  - Clients with Warnings
  - Tasks In Progress
  - Delayed Tasks
  - Tasks Done This Week
- **My Clients List** مع search + filters
- لكل project — **Client Detail Modal**:
  - Client journey timeline (call logs → meetings → deal → tasks → notes → warnings → payments)
  - Team assignments (مين شغال على المشروع: TLs + agents)
  - Tasks per team مع status + progress %
  - All notes from all team members
  - Files
  - Project logs (audit trail)
- زرار **Warning** على كل عميل
- زرار **Setup Project** للـunsetup projects

#### العمليات:
- `PATCH /api/projects/[id]/setup` — setup الـproject (niche, storeUrl, driveLink, finalDeadline, notes)
- `POST /api/projects/distribute` — توزيع للـHead SEO فقط (per `DISTRIBUTION_MAP[account_manager] = ["head_seo"]`)
- `POST /api/warnings` — إصدار تحذير
- `PATCH /api/projects/lifecycle` — تغيير lifecycle (own projects only)
- `POST /api/notes` — إضافة ملاحظة بـcategory=`account_manager`
- view-only لكل ما عمله الفريق (tasks, notes, files)

#### المخرجات:
- DB: Project (setup fields), Note, Warning + WarningReceipt, TeamAssignment (لو وزع)
- Notifications للفريق المتأثر
- audit logs

#### التفاصيل اللي يشوفها للعميل:
1. **رحلة كاملة** من أول call log في TeleSales لحد آخر task من Operations
2. **مين الـsalesAgent** اللي قفّل الديل + الـnotes اللي كتبها
3. **مين الـ tele_sales_agent** اللي بدأ التواصل + ملاحظاته
4. **كل التيم الحالي** على المشروع (TLs + agents per department)
5. **حالة كل task** + progress + dates
6. **Notes من أي عضو** في الفريق
7. **Warnings مفتوحة** عليه

---

### 3.5 head_technical

**المهمة**: المدير التقني — يستقبل المشاريع من HAM، يوزع على Team Leaders للـSocial Media و Media Buyer.

**الـSidebar Items**:
- Technical Overview (`/head-technical`)
- All Client Projects (`/operations`)

#### المدخلات (ما يشاهده):
**[head-technical/page.tsx](src/app/dashboard/head-technical/page.tsx)** — `where: { headTechnicalId: user.id }`:

- **KPI Cards**: Assigned Clients, Active, Delayed, Tasks In Progress
- **Master Clients List** — مشاريعه فقط مع team assignments المتاحة
- **Available Team Leaders**:
  - Team Leader Social Media (مع عدد active assignments)
  - Team Leader Media Buyer (مع عدد active assignments)
  - **NOT Head SEO** — حسب الـspec ده مش من صلاحياته (تم تصحيحه في Sprint 1)

#### العمليات:
- `POST /api/projects/distribute` لـ`team_leader_social_media` و `team_leader_media_buyer` فقط
- يفتح Client Detail Modal للـmonitoring فقط

#### المخرجات:
- DB: TeamAssignment (للـTLs)
- Notifications للـTL المعيّن

---

### 3.6 head_seo

**المهمة**: المدير الأول للـSEO — يستقبل المشاريع من AM (أو HAM)، يوزع على Team Leader SEO.

**الـSidebar Items**:
- SEO Projects (`/seo`)

#### المدخلات (ما يشاهده):
**[seo/page.tsx](src/app/dashboard/seo/page.tsx) + [SeoClient.tsx](src/app/dashboard/seo/SeoClient.tsx)** — view مختلف حسب الـrole:

**Head SEO View**:
- KPI: Total Projects, Unassigned, In Progress, Delayed, Done This Week
- Incoming clients distribution panel
- Team overview (TL SEO + agents)
- Cross-team task creation form (content_seo + design)
- Task filtering and status

#### العمليات:
- `POST /api/projects/distribute` للـ`team_leader_seo`
- `POST /api/tasks` — إنشاء tasks تتوجه للـTL تلقائياً (أو direct لـagent)
- يقدر ينشئ cross-team tasks للـ`leader_graphic_designer`, `leader_motion_graphic`, `leader_ui`

#### المخرجات:
- DB: Task, TeamAssignment, ProjectLog
- Pusher: `task-assigned` على `private-user-${leaderId}`

---

### 3.7 team_leader_seo

**المهمة**: قائد فريق SEO — يستقبل من Head SEO، يوزع على agent_seo و agent_content_seo.

**الـSidebar Items**:
- SEO Projects (`/seo`)

#### المدخلات (ما يشاهده):
**SeoClient.tsx (TL view)**:
- KPI: My Projects, Pending Tasks, In Progress, Delayed, Completed
- Incoming clients waiting for agent assignment
- My Team overview (per-agent workload)
- All Tasks table مع filters
- زرار "Assign" لكل task فاضي

#### العمليات:
- `POST /api/projects/[id]/assign-agent` — أسـsign agent_seo / agent_content_seo
- `PATCH /api/tasks/[id]` — reassign agent on existing task
- `POST /api/tasks/[id]/reassign` — حركة reassign بين agents بتاعه
- يستقبل cross-team tasks من Social/Media agents (taskType=`content_seo`)

#### المخرجات:
- DB: Task.agentId update, TeamAssignment, ProjectLog
- Notifications للـagent

---

### 3.8 agent_seo & 3.9 agent_content_seo

**المهمة**: تنفيذ tasks SEO/Content — تحديث progress، رفع deliverables، إنشاء cross-team tasks.

**الـSidebar Items**:
- My Tasks (`/seo`)

#### المدخلات (ما يشاهده):
- KPI: My Projects, Pending, In Progress, Completed, Warnings
- My Clients list — كل العملاء اللي عنده tasks فيهم
- Per task: brief, taskLink, deadline, priority, progress checklist
- Client journey timeline لأي عميل
- All notes from any team member على نفس العميل (للسياق)

#### العمليات:
- `PATCH /api/tasks/[id]` — تحديث:
  - status: pending → in_progress → review → done
  - progressPct (0–100)
  - checklistItems (JSON)
  - files (JSON: deliverable URLs)
  - completedAt
- `POST /api/tasks/[id]/flag` — رفض task مع reason (يرجع للـTL)
- `POST /api/tasks` — إنشاء cross-team task (content_seo / ui_design)
- `POST /api/notes` — كتابة ملاحظة على المشروع
- `PATCH /api/projects/[id]` — تعديل حقول محدودة (storeCreated, userCreatedStore flags)

#### المخرجات:
- DB: Task updates, Note, ProjectLog
- Notifications للـTL/AM
- Pusher: task progress updates
- Project progress recalculation تلقائي (avg of taskType-grouped tasks)

---

### 3.10 team_leader_social_media

**المهمة**: قائد فريق السوشيال — يستقبل من Head Technical، يوزع على agent_social_media.

**الـSidebar Items**:
- Social Projects (`/social-media`)

#### المدخلات (ما يشاهده):
**[SocialMediaClient.tsx](src/app/dashboard/social-media/SocialMediaClient.tsx)**:
- KPI: My Projects, Pending Tasks, In Progress, Delayed, Completed
- Incoming clients distribution panel
- My Team overview
- All Clients list مع filters
- Tasks overview

#### العمليات:
- `POST /api/projects/[id]/assign-agent` — لـagent_social_media
- `PATCH /api/tasks/[id]` — reassign tasks
- يقدر ينشئ cross-team tasks (graphic / motion / ui)

#### المخرجات:
- DB: TeamAssignment, Task, Notification

---

### 3.11 agent_social_media

**المهمة**: موظف social media — تنفيذ tasks + إنشاء cross-team requests للـDesign/Motion/UI.

#### المدخلات:
- My Tasks list
- Client info & full journey timeline
- All team notes

#### العمليات:
- `PATCH /api/tasks/[id]` — تحديث status/progress/files
- `POST /api/tasks/[id]/flag` — flag للـTL
- `POST /api/tasks` — إنشاء cross-team task:
  - taskType=`graphic_design` → routes تلقائياً لـ`leader_graphic_designer`
  - taskType=`motion_graphic` → `leader_motion_graphic`
  - taskType=`ui_design` → `leader_ui`
- `POST /api/notes`

#### المخرجات:
- DB: Task creation للـDesign teams + Task updates لـown
- Cross-team coordination

---

### 3.12 team_leader_media_buyer & 3.13 agent_media_buyer

نفس النمط بالضبط زي Social Media:
- TL: يستقبل من Head Technical، يوزع على agent_media_buyer
- Agent: ينفذ campaigns + ينشئ cross-team tasks للـDesign

**الفرق الوحيد**: department=`media_buyer` بدل `social_media`.

---

### 3.14 leader_graphic_designer

**المهمة**: مدير قسم الجرافيك — يستقبل tasks تلقائياً من أي agent (Social/Media/SEO) مع taskType=`graphic_design`، يوزعها على agent_graphic_designer.

**الـSidebar Items**:
- Graphic Design (`/design?team=graphic`)

#### المدخلات (ما يشاهده):
**[DesignClient.tsx](src/app/dashboard/design/DesignClient.tsx)** — Leader view (3 tabs):

1. **Incoming**: tasks جديدة بدون agent مسـsigned
2. **My Team**: agents بتاعته + workload
3. **All Tasks**: كل tasks الفريق مع KPIs:
   - Incoming New
   - In Progress
   - Done This Week
   - Delayed
   - Team Size

- Filters: search / status / priority
- per task: requesterRole (مين طلبها), brief, taskLink, deadline

#### العمليات:
- زرار "Assign" → `PATCH /api/tasks/[id]` بـagentId
- `POST /api/tasks/[id]/reassign` — حركة بين agents

#### المخرجات:
- DB: Task.agentId, TeamAssignment (auto-created in tasks PATCH)
- Notifications للـagent

---

### 3.15 agent_graphic_designer

**المهمة**: مصمم جرافيك — ينفذ tasks الـgraphic_design.

#### المدخلات:
**DesignClient.tsx** — Agent view:
- KPI: Pending, In Progress, Completed, Delayed
- My Tasks table مع filters
- لكل task: client info, brief, taskLink, files
- زرار "View Project Journey" لرؤية السياق

#### العمليات:
- `PATCH /api/tasks/[id]`:
  - status: pending → in_progress (مع startedAt) → done (مع completedAt)
  - files: rفع روابط الـdeliverables
  - progressPct
- `POST /api/tasks/[id]/flag` — رفض مع reason

#### المخرجات:
- DB: Task updates, files JSON, ProjectLog (auto)
- Notifications للـTL/AM لما task يخلص

---

### 3.16 leader_motion_graphic & 3.17 agent_motion_graphic

نفس النمط بالضبط زي Graphic لكن taskType=`motion_graphic`. الـURL: `/design?team=motion`.

---

### 3.18 leader_ui & 3.19 agent_ui

نفس النمط بالضبط زي Graphic لكن taskType=`ui_design`. الـURL: `/design?team=ui`. الـUI agent يستقبل برضو من SEO agents (cross-team UI design tasks).

---

### 3.20 hr_manager

**المهمة**: مدير HR — يدير الـheadcount كله: hiring، promotions، warnings الأداء، leave requests، documents، attendance.

**الـSidebar Items**:
- Attendance (`/hr`)
- Employee Directory (`/hr`)
- Hiring Pipeline (`/hr/hiring`)
- Leave Requests (`/hr/requests`)

#### المدخلات (ما يشاهده):
**[HrClient.tsx](src/app/dashboard/hr/HrClient.tsx)** — 5 tabs:

1. **📅 Attendance**: check-in/out + history لكل الموظفين
2. **👥 Employees**: جدول كامل مع department, role, status, joined date — مع زرار Add/Edit/Toggle Status
3. **🏢 Departments**: ملخص لكل قسم (active vs total)
4. **🏆 Promotion Engine** ([api/hr/promotion-engine](src/app/api/hr/promotion-engine/route.ts)):
   - 3 KPIs: Eligible to Promote / Warnings / At Risk
   - زرار "Run 3-Month Eval" يحلل تلقائياً
   - per employee: avgAchievementPct، monthsEvaluated، recommendation، actions (Promote / Warn / Terminate / Clear)
5. **📄 Employee Documents**:
   - فلتر per-employee أو all
   - Upload modal: name + fileUrl
   - View / Delete

**[hiring/HiringClient.tsx](src/app/dashboard/hr/hiring/HiringClient.tsx)** — Kanban بـ6 stages:
New → HR_Interview → Department_Interview → Offer → Hired / Rejected

**[requests/page.tsx](src/app/dashboard/hr/requests/page.tsx)** — Leave/Remote requests:
- Pending list + Approve/Reject buttons

#### العمليات:
- `POST /api/hr/employees` — إنشاء موظف
- `PATCH /api/hr/employees` — تعديل / تفعيل / تعطيل
- `POST /api/attendance` — check-in/out
- `POST /api/hr/promotion-engine` — actions:
  - `promote` (يغير User.level + اختياري User.role لـTL، ينشئ notification)
  - `warn` (يزيد warningCount، يعلم terminationFlag لو ≥3، notification)
  - `terminate` (يعلم terminationFlag + status=Inactive، notification)
  - `clear` (يصفر warnings + flags)
- `POST /api/hr/evaluations` — auto-evaluation للـ3 شهور الأخيرة
- `POST /api/hr/applicants` + `PATCH /api/hr/applicants/[id]` — إدارة الـcandidates
- `PATCH /api/hr/requests/[id]` — Approve/Reject leave
- `POST /api/hr/documents` (HR can upload for any user) + `DELETE`

#### المخرجات:
- DB: User updates, HrRecord (warningCount, terminationFlag, promotionEligible, level), JobApplicant, LeaveRequest, EmployeeDocument, Attendance, Notification

#### تفاصيل Promotion Engine الـ logic (per spec):
```
last 3 months avg achievement %:
  < 50%       → terminate
  50–70%      → warn
  ≥ 60% (Junior) → promote to Mid
  ≥ 80% (Mid)    → promote to Senior
  ≥ 80% (Senior + has TL role mapping) → promote to TL role
```

---

### 3.21 accountant

**المهمة**: محاسب — يتابع الـrevenue، يحدد الـinstallments المدفوعة، يحسب commissions الـsales agents شهرياً.

**الـSidebar Items**:
- Finance Dashboard (`/finance`)

#### المدخلات (ما يشاهده):
**[FinanceClient.tsx](src/app/dashboard/finance/FinanceClient.tsx)** — 3 tabs:

1. **💰 All Deals**:
   - KPI: Total Revenue, Total Collected, Total Remaining, Upcoming Installments
   - جدول كل الـdeals: client, agent, totalAmount, collected, status (Fully Paid / Partial)
   - Filter: all / fully_paid / partial / overdue
2. **📆 Pending Installments**:
   - cards لكل installment غير مدفوعة + due date
   - زرار "Mark as Paid"
3. **🧮 Commissions**:
   - Month picker
   - **Net Target Formula** card معروضة: `Net = Cash × 1.0 + (Tabby/Tamara × (1−fee))`
   - Tier brackets card
   - 3 KPIs: Total Net Achieved / Total Payout / Finalized count
   - جدول per agent: Monthly Target, Net Achieved, Achievement %, Commission, Bonus/Deduct, Net Payout, Actions
   - زرار **Recompute Month** يعيد حساب كل الـcommissions من الـdeals
   - زرار **Export XLSX** ينزل ملف Excel كامل
   - زرار **Edit** لكل commission يفتح modal لـbonuses/deductions
   - زرار **Finalize** يقفل الـcommission immutable

#### العمليات:
- `PATCH /api/finance/installments/[id]` — mark paid
- `POST /api/finance/commissions` — recompute month (يحسب لكل sales_agent من deals الشهر)
- `PATCH /api/finance/commissions/[id]` — bonuses/deductions/finalize
- `GET /api/finance/commissions/export?month=...` — تنزيل XLSX

#### المخرجات:
- DB: Installment.isPaid, Commission rows (netTarget, commissionPct, commissionAmount, bonuses, deductions, netPayout, finalized)
- ملفات Excel للموظفين/الإدارة

#### الـformula الكاملة (per spec):
```
For each sales_agent in month:
  netTarget = Σ deals where agent + month + Closed_Won
              ├ Cash payment      → totalAmount × 1.00
              └ Tabby/Tamara      → totalAmount × (1 − gateway_fee_pct)

  baseCommission = tier-bracket calculation:
    1,000–15,000     → 1.5%
    15,001–20,000    → 2.0%
    20,001+          → 2.5%

  achievementPct = (netTarget / hrRecord.monthlyTarget) × 100
  multiplier:
    < 100%  → pro-rata
    ≥ 100%  → 1.00
    ≥ 125%  → 1.25
    ≥ 150%  → 1.50  (capped)

  commissionAmount = baseCommission × multiplier
  netPayout = baseSalary + commissionAmount + Σ bonuses − Σ deductions
```

---

### 3.22–3.25 Frozen Roles (TeleSales + Sales)

#### tele_sales_manager
- Sidebar: TeleSales section (Leads, Upload, Cold Leads, My Team, Team Analytics, Recycle)
- يقدر يـreassign leads بين الـagents
- targets management
- aggregated team view

#### tele_sales_agent
- Sidebar: Leads, Meets, My Progress, Add Cold Leads
- Lead management مع call logging modal
- Filter Hot/Warm/Cold
- Schedule meetings → trigger auto-assignment

#### sales_manager
- Sidebar: Opportunities, My Team, Team Analytics, Recycle Bin
- Live status of agents (Available/Busy/In_Call)
- Master sheet view
- Issue warnings

#### sales_agent
- Sidebar: Opportunities, My Progress
- Status toggle (Available/Busy/In_Call) + timer
- Feedback Form (mandatory before switching client)
- Deal Closing Form (package, totalAmount, payment method, installments, contract URL)

> هذه الأدوار لم تُعدَّل في كل الـSprints الأخيرة بناء على تأكيد المستخدم.

---

## 4. الأنظمة المشتركة (Cross-Cutting)

### 4.1 Warning System

**Components**:
- [CreateWarningModal.tsx](src/components/CreateWarningModal.tsx) — يفتحه `account_manager` / `head_account_manager` / `sales_agent` / `sales_manager`
- [WarningPopup.tsx](src/components/WarningPopup.tsx) — full-screen blocking modal
- [GlobalWarningAlert.tsx](src/components/GlobalWarningAlert.tsx) — floating alert
- [WarningResolveButton.tsx](src/components/WarningResolveButton.tsx)

**Flow**:
1. Issuer يفتح Modal، يكتب message + severity (Low/Medium/High/Critical) + يحدد الـrecipientRoles
2. `POST /api/warnings`:
   - ينشئ Warning row
   - يحدد كل المستخدمين المرتبطين بالمشروع (AM, HT, HSEO, all team assignments, Head AMs)
   - ينشئ WarningReceipt لكل واحد
   - يطلق Pusher على `user-${id}` بـevent `new-warning`
   - يبعت email
3. كل user متأثر يفتح dashboard:
   - WarningPopup يعمل GET `/api/warnings` → يجيب الـunread
   - يعرض popup blocking لحد ما يضغط "Acknowledge"
4. `POST /api/warnings/[id]/acknowledge` → يعمل WarningReceipt.isRead=true
5. لو user جديد ينضم للمشروع بعد إصدار الـwarning، `backfillReceiptsForNewMember()` ينشئ له receipt فوراً
6. الـissuer لما يحب يحلها: `POST /api/warnings/[id]/resolve` → status=Resolved
7. أي project action (status change / task progress) بتـcheck `checkProjectBlockers()` — لو في unread warning بترفض الـaction بـ403

### 4.2 Client Journey Timeline

[ClientJourney.tsx](src/components/ClientJourney.tsx) — يعرض timeline موحد لكل أحداث العميل:

| Stage | Source | Data |
|---|---|---|
| project_creation | Project.createdAt | system event |
| telesales | CallLog | callStatus, classification, notes, agent |
| sales | Meeting | status, salesNotes, dealAmount |
| deal | Deal | package, totalAmount, paymentMethod, status |
| technical | Task | progress, status, priority, assignedRole |
| note | Note | category-tagged text from any team member |
| warning | Warning | severity, message, sender |
| payment | Installment | amount, dueDate, paid status |

كل عضو في فريق المشروع يقدر يقرأ كل الـnotes من باقي الفريق + كل الـcalls/meetings/deal context.

### 4.3 Notifications (real-time)

- Model: `Notification { userId, title, message, type, link, read, relatedId }`
- Pusher channel per user: `user-${userId}`
- Events: `new-notification`, `new-warning`, `task-assigned`, `team-assigned`, `lifecycle-changed`
- Component: [NotificationBell.tsx](src/components/NotificationBell.tsx) — أيقونة في الـheader/sidebar

### 4.4 Master Sheet

[master-sheet/page.tsx](src/app/dashboard/master-sheet/page.tsx) — super_admin only. View موحد لكل الـleads → meetings → deals → projects.

### 4.5 Distribution Rules (`DISTRIBUTION_MAP`)

```
super_admin               → كل الأدوار (override)
head_account_manager      → account_manager, head_technical, head_seo
account_manager           → head_seo
head_technical            → team_leader_social_media, team_leader_media_buyer
head_seo                  → team_leader_seo
team_leader_seo           → agent_seo, agent_content_seo
team_leader_social_media  → agent_social_media
team_leader_media_buyer   → agent_media_buyer
leader_graphic_designer   → agent_graphic_designer
leader_motion_graphic     → agent_motion_graphic
leader_ui                 → agent_ui
```

كل API distribution call بتمر عبر `canDistributeTo(distributorRole, targetRole)` قبل أي DB write.

### 4.6 Cross-Team Task Routing

```
agent_social_media / agent_media_buyer / agent_seo
   ──[create task]──> taskType determines auto-routing:
       graphic_design  → leader_graphic_designer
       motion_graphic  → leader_motion_graphic
       ui_design       → leader_ui
       content_seo     → team_leader_seo
```

Source: `findTeamLeaderRoleForTaskType()` in [src/lib/distribution.ts](src/lib/distribution.ts).

---

## 5. الـAPIs (مختصر)

### Authentication
- `POST /api/auth/[...nextauth]` — login (NextAuth Credentials provider, email/phone + password)

### Users
- `GET/POST /api/users` — list/create (super_admin/hr_manager only)
- `PATCH /api/users/[id]` — update
- `PATCH /api/users/[id]/status` — activate/deactivate
- `PATCH /api/users/[id]/specialization` — Hot/Warm/Cold
- `PATCH /api/users/[id]/target` — monthly target

### Leads
- `GET/POST /api/leads` — list (filtered) / create (telesales+admin)
- `PATCH/DELETE /api/leads/[id]`
- `POST /api/leads/import` — XLSX bulk import
- `POST /api/leads/bulk/promote` — Cold → Warm/Hot bulk
- `POST /api/leads/bulk/delete`

### Calls / Meetings / Deals
- `POST /api/call-logs` — telesales agent logging
- `POST /api/deals` — sales agent close
- `GET /api/deals/list`

### Projects
- `POST /api/projects/setup` — auto-created from Closed_Won deal
- `GET/PATCH /api/projects/[id]` — detail (with ownership check) / patch (allow-listed fields)
- `POST /api/projects/[id]/setup` — AM-only setup
- `POST /api/projects/[id]/assign` — assign AM/HT/HSEO
- `POST /api/projects/[id]/assign-agent` — assign agent (TL only, with `canDistributeTo` check)
- `POST /api/projects/[id]/team-assignment` — generic team assignment
- `POST /api/projects/[id]/reassign-am` — replace AM
- `GET /api/projects/[id]/files`, `GET /api/projects/[id]/logs`, `PATCH /api/projects/[id]/status`
- `POST /api/projects/distribute` — multi-role distribution
- `PATCH /api/projects/lifecycle` — state machine transitions

### Tasks
- `GET/POST /api/tasks` — list / create (with role + project membership check)
- `GET/PATCH /api/tasks/[id]` — detail / update (status, progress, files, assigned agent)
- `POST /api/tasks/[id]/flag` — agent flags back to leader
- `POST /api/tasks/[id]/reassign` — leader reassigns within team
- `POST /api/tasks/generate` — auto-bootstrap tasks for project
- `GET /api/tasks/self` — agent's own tasks

### Warnings
- `GET /api/warnings` — current user's unread warnings
- `POST /api/warnings` — issue (with auto-recipient detection)
- `GET /api/warnings/unread` — unread receipts only
- `POST /api/warnings/[id]/acknowledge` — read receipt
- `POST /api/warnings/[id]/resolve` — sender only
- `GET /api/warnings/log` — audit log (heads only)

### Notes
- `GET/POST /api/notes` — list (per-project, with access check) / create

### Notifications
- `GET/PATCH /api/notifications`, `PATCH /api/notifications/[id]`
- `POST /api/notifications/send` — managerial roles only

### Team Assignments
- `GET/DELETE /api/team-assignments` — per-project listing / removal

### HR
- `GET /api/hr/employees`
- `GET/POST/PATCH /api/hr/applicants`, `PATCH /api/hr/applicants/[id]`
- `GET/POST/PATCH /api/hr/requests`, `PATCH /api/hr/requests/[id]`
- `GET/POST/DELETE /api/hr/documents`
- `POST /api/hr/evaluations` — auto-eval
- `GET/POST /api/hr/promotion-engine` — list + actions
- `POST /api/attendance`

### Finance
- `GET /api/finance/overview` — deals + installments aggregate
- `PATCH /api/finance/installments/[id]` — mark paid
- `GET/POST /api/finance/commissions` — list / recompute
- `PATCH /api/finance/commissions/[id]` — bonuses, deductions, finalize
- `GET /api/finance/commissions/export` — XLSX

### Settings
- `POST /api/settings` — generic key/value upsert
- `POST /api/settings/commissions` — per-role commission rule

### Analytics
- `GET /api/analytics/agent` — single agent stats
- `GET /api/analytics/team` + `/api/analytics/team/drill`
- `GET /api/analytics/sales-team` + drill
- `GET /api/analytics/sales-agent`
- `GET /api/analytics/chief-sales`
- `GET /api/analytics/my-progress` — current user's KPIs
- `GET /api/analytics/drill-down` — generic drill

### Custom Columns
- `GET/POST /api/custom-columns`
- `GET/POST /api/custom-columns/values`

### Misc
- `GET/POST /api/niches`
- `GET/POST /api/packages`
- `GET /api/cron/reminders` — cron-driven reminders

---

## 6. الـData Models (Prisma)

الـ20 model الرئيسية:

**Identity**: `User` (24 roles)، `HrRecord`، `EmployeeDocument`، `Attendance`، `LeaveRequest`، `JobApplicant`

**Sales Pipeline**: `Lead`، `CallLog`، `Meeting`، `Deal`، `Installment`، `AgentTarget`، `Niche`، `CustomColumn` + `CustomColumnValue`

**Operations**: `Project`، `Task` (with parentTaskId for sub-tasks)، `TeamAssignment`، `ProjectFile`، `ProjectLog`، `Package`

**Communication**: `Note` (categorized)، `Warning` + `WarningReceipt`، `Notification`

**System**: `SystemConfig`، `CommissionRule`، `Commission`

كل العلاقات معرفة في [prisma/schema.prisma](prisma/schema.prisma).

---

## 7. تشغيل المشروع محلياً

```bash
# 1. التركيب
cd Thamaraaa
npm install

# 2. ضبط الـ.env
# يحتاج DATABASE_URL (Postgres) + NEXTAUTH_SECRET + (اختياري) PUSHER_* + SMTP_*

# 3. الـDB
npx prisma generate
npx prisma db push          # أو: npx prisma migrate deploy في الإنتاج
node prisma/seed.js          # ينشئ super_admin افتراضي

# 4. التشغيل
npm run dev                  # http://localhost:3000
# أو للإنتاج:
npm run build && npm start
```

**Default super_admin**: `admin@thamaraa.com` / `admin123` (شيله أو غيّره قبل الإنتاج).

---

## 8. ملاحظات مهمة على الحوكمة

- **TeleSales/Sales dashboards مجمدين** — موصوفين هنا للسياق فقط، لكن الكود ما يتعدلش فيهم.
- **Authorization قوية** — كل API route فيه `getServerSession` + role check + project membership check (للـIDOR prevention).
- **Warning Popup blocking** — مفيش طريقة تتجاوزه (مفيش X button، مفيش click outside).
- **Real-time** عبر Pusher — لو env كي pusher مش معمول، التطبيق هيشتغل لكن real-time هيتعطل.
- **Email** عبر Nodemailer — لو SMTP مش معمول، الـwarning emails تفشل بصمت لكن الـin-app delivery يكمل.
- **Build flags** في `next.config.mjs` لسه بتتجاهل TS+ESLint errors — Sprint 2 (audit recommendation) لسه ما اتعملش.

---

## 9. الـ Sprints المنفذة

### Sprint 1 — Critical Security & Bugs (تم)
- 12 Critical fix + HIGH-04 (تفاصيل في [AUDIT_REPORT.md](AUDIT_REPORT.md))
- Warning popup endpoint + Pusher channel
- Mass assignment fix
- IDOR fixes (projects, notes, team-assignments, tasks, notifications/send)
- Lifecycle case mismatch
- Head Technical scope correction
- Phone-empty user creation bug

### Sprint 2 — Spec Completion (تم)
- HR Promotion Engine + UI
- Employee Documents tab
- Finance Commissions screen + XLSX export
- Settings: Finance Rules + Permission Matrix tabs

### Sprint 3 — Quality Gates (لسه)
- إزالة `ignoreBuildErrors` + `ignoreDuringBuilds`
- Tests (Vitest + Supertest)
- CI/CD (.github/workflows)
- Prisma migrations folder
- Rate limiting on login
- Structured logging (pino)
- Sentry / observability

---

## 10. خريطة الملفات السريعة

```
Thamaraaa/
├── prisma/
│   ├── schema.prisma                   # 20 models
│   └── seed.js                         # super_admin seed
├── src/
│   ├── app/
│   │   ├── api/                        # 65+ API routes
│   │   ├── dashboard/                  # 25+ dashboard pages
│   │   └── login/                      # NextAuth login
│   ├── components/                     # 24 shared components
│   └── lib/
│       ├── auth.ts                     # NextAuth config
│       ├── prisma.ts                   # client singleton
│       ├── pusher.ts                   # real-time setup
│       ├── email.ts                    # Nodemailer
│       ├── constants.ts                # role arrays + enums
│       ├── distribution.ts             # DISTRIBUTION_MAP + helpers
│       ├── lifecycle.ts                # state machine
│       ├── promotion.ts                # ★ HR promotion engine logic
│       ├── commissions.ts              # ★ commission formula
│       └── autoAssign.ts               # smart lead assignment
├── AUDIT_REPORT.md                     # senior enterprise audit
├── WALKTHROUGH.md                      # ★ هذا الملف
└── فكره المشروع باختصار عمتاً.md       # المواصفات الأصلية
```
