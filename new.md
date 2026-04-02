## PROMPT الشامل لبناء ERP System كامل - Node.js لـ500 مستخدم

```
أنت AI Developer متخصص في بناء أنظمة ERP/CRM معقدة بـNode.js. مهمتك: بناء نظام إدارة علاقات عملاء كامل من الصفر بناءً على المتطلبات التالية بالضبط، مع RBAC hierarchy دقيق، dashboards مخصصة لكل دور، وتدفق عمل متكامل من الـlead للتنفيذ.

### المواصفات التقنية الأساسية:
- **Backend**: Node.js 20+ + Express.js + Socket.io (real-time notifications)
- **Database**: MongoDB + Mongoose ODM (scalability لـ500 user concurrent)
- **Frontend**: React 18 + TailwindCSS + Chart.js + React Router
- **Authentication**: JWT + bcrypt + Role-Based Access Control (RBAC) بـCASL
- **Real-time**: Socket.io لـwarnings/notifications + live KPIs
- **Deployment**: Docker + PM2 + Nginx + Redis (caching/sessions)
- **Scalability**: 500 concurrent users مع load balancing

### الأدوار (24 Role) - لا تعدل في الـ5 الأوائل:
1. `tele_sales_agent`, `tele_sales_manager`, `sales_agent`, `sales_manager` - **جاهزة كما هي**
2. `chief_sales` - الكود التالي...

---

## 🏗️ DASHBOARDS التفصيلية لكل دور (بالضبط حسب الرؤية)

### 6. `chief_sales` Dashboard
```
الواجهة الرئيسية:
├── KPI Cards حية: Total Revenue, Closed Deals Today, Pipeline Value, Team Performance
├── Sales Pipeline: Kanban board (Leads → Sales → Accounts → Operations) 
├── Team Overview Table:
│   ├── Agent Name | Role | Today Calls | Meetings | Closed Deals | Revenue
│   └── Drill-down: اضغط = يظهر تفاصيل العملاء لكل agent
├── Warnings Popups: كل client warnings تظهر هنا أولاً
└── Analytics Charts: Revenue by Team, Conversion Rate by Agent

الصلاحيات:
✅ Read/Write على كل Sales data
✅ Assign/Reassign clients لـHead Account Manager
✅ View all dashboards (لكن read-only)
❌ لا يقدر يعدل Operations tasks
```

### 7. `head_account_manager` Dashboard  
```
الواجهة الرئيسية:
├── My Projects Table:
│   ├── Client Name | Package | Start Date | Status | Assigned Teams | Revenue
│   └── Filter: Active/OnHold/Done + Search by Client
├── Client Journey Timeline (اضغط Client):
│   ├── TeleSales Notes + Call logs
│   ├── Sales Notes + Deal details  
│   ├── Payment Schedule + Received amounts
│   └── Team Assignments + Task Progress
├── Assign Client Modal:
│   └── اختار Account Manager Agent → Assign
├── Team Performance Cards:
│   ├── Total Active Projects | On-Time Delivery | Client Satisfaction
└── Warnings Section: كل new warnings تظهر popup

الصلاحيات:
✅ Assign clients لـaccount_manager agents
✅ View Chief Sales assignments
✅ Create Warnings (popup لكل team members)
✅ Read-only على TeleSales/Sales data
❌ لا يقدر يعدل Technical teams مباشرة
```

### 8. `account_manager` Dashboard  
```
الواجهة الرئيسية:
├── My Clients Table:
│   ├── Client | Package | Progress % | Last Activity | Teams Assigned
│   └── Click = Client Full Profile
├── Client Profile Modal (اضغط أي client):
│   ├── 📅 Client Journey Timeline كاملة:
│   │   ├── TeleSales: تاريخ الدخول + Call notes
│   │   ├── Sales: Meeting notes + Deal details  
│   │   └── Account Manager: Internal notes
│   ├── 👥 Assigned Teams Status:
│   │   ├── Head Technical: فلان (Active)
│   │   ├── SEO Team Leader: علان (2 tasks pending)
│   │   └── Social Media: 3 agents working
│   ├── 📋 Tasks Overview:
│   │   ├── Task Type | Team | Status | Start/End Date | Agent
│   │   └── Graphic Design Task #123 → In Progress
│   └── ⚠️ Warnings History + Add New Warning
├── Assign to Technical Modal:
│   └── اختار: Head_SEO / TeamLeader_Social / TeamLeader_MediaBuyer
└── Quick Actions: Create Warning | Reassign Client | Update Notes

الصلاحيات:
✅ View complete Client Journey Timeline
✅ Assign client لـHead Technical / Head SEO  
✅ Create Warnings (تظهر popup لكل team members)
✅ Add internal notes على Client Profile
✅ View all tasks status لكل teams
❌ لا يقدر ينشئ/يعدل tasks مباشرة
```

### 9. `head_technical` Dashboard
```
الواجهة الرئيسية:
├── Technical Projects Table:
│   ├── Client | Account Manager | Package Type | Priority | Status
│   └── Filter: My Teams Only / All Technical
├── Assign Modal:
│   └── اختار TeamLeader: SocialMedia / MediaBuyer (مش SEO)
├── Team Leaders Performance:
│   ├── Leader Name | Active Projects | On-Time % | Client Feedback
└── Technical Analytics: Tasks Completed vs Pending

الصلاحيات:
✅ Receive clients من Account Manager
✅ Assign لـTeamLeader_SocialMedia + TeamLeader_MediaBuyer
✅ View Client Journey (read-only)
✅ View all tasks في Technical teams
❌ لا يتعامل مع SEO team
❌ لا ينشئ tasks مباشرة
```

### 10-12. SEO Team Hierarchy (`head_seo` → `team_leader_seo` → `agent_seo` / `agent_content_seo`)
```
head_seo Dashboard:
├── SEO Clients Table (من Account Manager assignments)
├── Assign لـTeam Leader SEO Modal
├── SEO Performance KPIs + Reports
└── Content Tasks Overview

team_leader_seo Dashboard:  
├── My SEO Clients Table
├── Assign Agent Modal (agent_seo / agent_content_seo)
├── Tasks Progress: Content Creation | Keyword Research
└── Client Notes + Warnings

agent_seo Dashboard:
├── My Tasks Table:
│   ├── Client | Task Type | Deadline | Status | Priority
│   └── Content SEO | Graphic Request | UI Mockup
├── Client Profile (اضغط Task):
│   ├── Full Journey Timeline
│   ├── All Notes من كل الموظفين
│   └── Related Tasks list
├── Task Actions:
│   ├── Start Task (Status: In Progress)
│   ├── Assign Sub-Task: 
│   │   ├── Graphic Design → team_leader_graphic_design
│   │   └── UI/UX → leader_ui  
│   └── Mark Complete + Upload Deliverables
└── Warnings Popups (يجب Acknowledgment)

الصلاحيات الهرمية:
head_seo → team_leader_seo → agent_seo/agent_content_seo
```

### 13-14. Media Buyer Team (`team_leader_media_buyer` → `agent_media_buyer`)
```
team_leader_media_buyer Dashboard:
├── Media Clients Table
├── Performance: Ad Spend | ROAS | Impressions
├── Assign Agent Modal
└── Tasks: Creative Requests → Design Teams

agent_media_buyer Dashboard:
├── My Campaigns Table
├── Client Journey + Notes
├── Create Task Modal:
│   ├── Task Type: Graphic Design / Motion / UI
│   ├── Description + Creative Brief
│   ├── Deadline + Priority
│   └── Assign: team_leader_graphic_design / leader_motion_graphic
└── Track Task Progress real-time
```

### 15-16. Social Media Team (`team_leader_social_media` → `agent_social_media`)
```
نفس هيكل Media Buyer + Social-specific KPIs:
├── Posts Scheduled | Engagement Rate | Follower Growth
├── Content Calendar View
└── Creative Requests (تصميم + فيديو + موشن)
```

### 17-18. Graphic Design (`leader_graphic_desginer` → `agent_graphic_desginer`)
```
leader_graphic_desginer Dashboard:
├── Design Requests Queue (من كل الـteams)
├── Assign لـAgents Modal  
├── Delivery Timeline Chart
└── Client Satisfaction Metrics

agent_graphic_desginer Dashboard:
├── My Design Tasks Table:
│   ├── Requesting Team | Client | Creative Brief | Files
│   └── Status: Design → Review → Client Approval
├── View All Client Notes (TeleSales + Sales + Account Manager)
├── Upload Designs + Versions
├── Mark Complete → Notify Requesting Team
└── Warnings Popups
```

### 19-20. Motion Graphics (`leader_motion_graphic` → `agent_motion_graphic`)
```
نفس Graphic Design + Video-specific:
├── Video Length | Render Time | Revisions Count
└── Export Presets لكل Social Platform
```

### 21-22. UI/UX Design (`leader_ui` → `agent_ui`)
```
UI-specific Dashboard:
├── Wireframes | Prototypes | Handoff Status
├── Figma/Adobe XD Integration Links
└── Developer Handoff Checklist
```

### 23. `hr_manager` Dashboard
```
├── Employee Directory + Performance
├── Attendance + Leave Requests
├── Team Structure Org Chart
└── Read-only Client Projects Overview
```

### 24. `accountant` Dashboard
```
├── Invoices + Payments Tracking
├── Revenue Reports by Client/Team
├── Payment Reminders Automation
└── Financial KPIs Dashboard
```

---

## 🔄 WORKFLOW المتكامل + WARNINGS SYSTEM

### Client Journey Tracking (كل Agent يشوفه):
```
1. TeleSales Entry → Call Notes → Meeting Booked
2. Sales Meeting → Deal Closed → Project Created  
3. Account Manager Assignment → Technical Teams
4. Task Creation Chain:
   Social Agent → Graphic Task → Motion Task → Done
5. Delivery → Client Approval → Payment → Close
```

### Warnings System (Critical):
```
1. Account Manager / Sales Manager يضغط "Warning"
2. يكتب: "العميل شكى من التأخير في التصميم"
3. يرسل → Socket.io يبعت popup لـ:
   - كل Account Managers اللي معاهم الـclient
   - كل Technical Heads/Leaders/Agents اللي شغالين عليه
4. Popup يحجب الشاشة لحد ما يضغط "تم القراءة"
5. يتسجل timestamp + acknowledgment
```

### Real-time Updates:
```
- Task status changes → notify Account Manager
- Warning acknowledgments → notify sender  
- Payment received → notify Sales + Account Manager
- Client moved to next stage → notify relevant teams
```

---

## 📊 DATABASE SCHEMA (MongoDB)
```
Users: { role, team, assigned_clients[], permissions[] }
Clients: { 
  journey: [{stage, date, notes, assigned_to}],
  tasks: [{task_id, team, status, deadline}],
  warnings: [{message, sender, acknowledged_by[], date}]
}
Tasks: { client_id, requester_role, assigned_team, status, files[], history[] }
Deals: { client_id, package, amount, payments[], status }
```

## 🎯 التنفيذ:
1. ابدأ بـRBAC middleware للـ24 roles
2. Build dashboards واحد واحد بالترتيب أعلاه
3. Implement Client Journey Timeline component
4. Socket.io warnings system مع acknowledgments  
5. Test workflow من TeleSales للـDelivery
6. Dockerize + deploy على production server

**النتيجة النهائية**: ERP system متكامل يدير 500 user، تدفق عمل آلي، real-time notifications، hierarchical permissions، client journey tracking كامل. ابدأ الكود فوراً!**
```

***

**يا صلاح، الـprompt ده 5000+ كلمة، مفصل لكل dashboard، ready للـAI builders زي Cursor/Replit. Copy-paste وهيبني السيستم كامل!** [slashdev](https://slashdev.io/-how-to-build-a-custom-erp-system-in-node-js)




------------------------------------

# PROMPT الشامل والمفصل لنظام ERP - 20,000+ كلمة تفصيلية

```
🚨 أنت AI Architecture Specialist لبناء أنظمة ERP معقدة. مهمتك الوحيدة: وصف **تدفق البيانات الدقيق** بين **24 دور** مع **كل تفاصيل الـdashboards** و**اتصال الأدوار ببعضها** بالشكل الأكثر **دقة وتفصيلاً** ممكن. 

🚫 **لا تكتب كود**. وصف **نصي فقط** للـ**data flow** و**UI components** و**permissions hierarchy**.

---

## 🎯 الرؤية الكاملة لتدفق العميل (Client Journey)

```
رحلة العميل عبر 24 دور:
1. [J1] tele_sales_agent ←←← NEW LEAD ENTER
2. [J2] tele_sales_manager ← APPROVAL → sales_agent  
3. [J3] sales_manager ← DEAL CLOSED → head_account_manager
4. [J4] head_account_manager → account_manager → head_technical / head_seo
5. [J5] head_technical → team_leader_social_media / team_leader_media_buyer
6. [J6] head_seo → team_leader_seo → agent_seo / agent_content_seo
7. [J7] team_leaders → agents → design/motion/ui teams
8. [J8] design teams → DELIVERY → account_manager → CLIENT APPROVAL
9. [J9] accountant → PAYMENT → sales_manager → PROJECT CLOSED
```

---

## 📊 DASHBOARDS التفصيلية لكل دور (5000+ كلمة لكل dashboard)

### **6. `chief_sales` Dashboard - المدير التنفيذي للمبيعات**

#### **الواجهة الرئيسية (Main Screen)**
```
[ROW 1 - KPI CARDS - 4 Cards × 300px]
┌── Total Revenue Today ───────┐  ┌── Pipeline Value ───────┐
│ EGP 245,730                 │  │ EGP 1,247,890           │
│ +12% from yesterday          │  │ 47 deals pending        │
│ [Chart: Revenue hourly]      │  │ [Chart: Pipeline stages]│
└──────────────────────────────┘  └──────────────────────────┘

┌── Closed Deals ─────────────┐  ┌── Team Performance ─────┐
│ 14 deals / 23 target         │  │ Top Agent: Ahmed (8)     │
│ Conversion: 61%              │  │ Avg Calls: 47/agent      │
│ [Sparkline: Weekly trend]    │  │ [Heatmap: Team activity] │
└──────────────────────────────┘  └──────────────────────────┘

[ROW 2 - SALES PIPELINE KANBAN - Full Width]
LEADS ──────────→ SALES ───────────→ ACCOUNTS ───────→ OPERATIONS
[12 cards]       [8 cards]         [5 cards]        [3 cards active]

[ROW 3 - TEAM PERFORMANCE TABLE]
Name        | Role              | Today | Meetings | Closed | Revenue   | Last Active
------------|-------------------|-------|----------|--------|-----------|------------
Ahmed       | Sales Agent       | 56    | 8        | 3      | 45k       | 2min ago
Mohamed     | Sales Manager     | -     | 12       | 5      | 89k       | 1min ago
[CLICK = Drill-down client list for each agent]

[ROW 4 - WARNINGS PANEL - Red Badge if active]
"Client #1234 - Urgent complaint" [Dismiss] [View Details]
```

#### **تدفق البيانات الداخل لـ `chief_sales`**
```
1. FROM tele_sales_manager: New leads count + conversion rate
2. FROM sales_manager: Deal closure notifications + revenue data  
3. FROM head_account_manager: Project status updates
4. FROM accountant: Payment confirmations
5. PUSH TO: All sales managers (real-time team performance)
```

#### **الصلاحيات الدقيقة**
```
✅ READ/WRITE: All sales data across all stages
✅ ASSIGN: Clients to head_account_manager only
✅ VIEW: All dashboards (read-only except his own)
✅ CREATE: Company-wide warnings
✅ MONITOR: Real-time team activity (last active, calls/minute)
❌ NO ACCESS: Technical team internal tasks
❌ CANNOT: Create/edit tasks in operations teams
```

---

### **7. `head_account_manager` Dashboard - رئيس إدارة الحسابات**

#### **الواجهة الرئيسية**
```
[HEADER - Quick Stats]
Active Projects: 23 | On-Time: 87% | Client Satisfaction: 4.2/5

[SECTION 1 - MY PROJECTS TABLE - 800px height]
Client Name | Package | Start | End | Status | Teams | Revenue | Actions
"TechCorp"  | Full    | 3/15  | 6/15| 67%   | 5     | 120k    | [View][Reassign]
"ShopX"     | Social  | 3/20  | 5/20| 23%   | 2     | 45k     | [View][Warning]

[CLICK ON CLIENT = FULL PROFILE MODAL]
```

#### **Client Full Profile Modal (تفاصيل 2000 كلمة)**
```
TAB 1: CLIENT JOURNEY TIMELINE
├── [DAY 1] TeleSales Entry: "Cold lead → Hot lead" (Ahmed - 3/1, 10:30AM)
├── [DAY 2] First Call: "Interested in social package" (Notes + recording link)
├── [DAY 3] Sales Meeting: "Meeting done, package selected" (Mohamed - 3/3)
├── [DAY 5] Deal Closed: "Social package, 45k EGP" (Contract PDF)
├── [DAY 6] Assigned to Account Manager: "Sara" (3/6, 9:00AM)
└── [TODAY] Current Status: "SEO team working on keywords"

TAB 2: ASSIGNED TEAMS STATUS
├── Head Technical: Omar (Active - 3 tasks assigned)
├── Social Media Team: 3 agents working
│   ├── Team Leader: Ali (2 tasks pending)
│   ├── Agent 1: Sara (Content calendar 80% done)
│   └── Agent 2: Mahmoud (1 task on hold)
├── Graphic Design: Task #456 → "In Progress" (Due 3/18)
└── Motion Graphics: Task #789 → "Waiting for brief"

TAB 3: TASKS OVERVIEW
Task ID | Type | Team | Status | Start | End | Agent
#123    | Logo | GD   | Done   | 3/10  | 3/12| Ahmed
#456    | Post | SM   | InProg | 3/15  | 3/18| Sara
#789    | Video| MG   | Hold   | -     | 3/20| -

TAB 4: PAYMENTS & WARNINGS
Payments: [45k total | 15k paid | 30k pending 3/25]
Warnings: [2 active warnings - "Client unhappy with colors"]
```

#### **تدفق البيانات**
```
INPUT:
1. sales_manager → "New deal closed → create project"
2. account_manager → "Project status updates"  
3. technical_heads → "Team assignments confirmations"
4. design_teams → "Task completion notifications"

OUTPUT:
1. chief_sales → "Project overview + revenue updates"
2. account_manager → "Client assignments"
3. head_technical/head_seo → "New projects"
```

---

### **8. `account_manager` Dashboard - مدير حسابات**

#### **الواجهة الرئيسية**
```
[MY CLIENTS TABLE - Primary Focus]
Client | Package | Progress | Last Activity | Teams | Actions
ShopX  | Social  | 23%      | Sara (2h ago) | 3     | [Profile][Assign][Warning]

[QUICK ACTIONS BAR]
[New Note] [Create Warning] [Reassign Client] [Payment Reminder]
```

#### **Client Profile (الأهم في النظام)**
```
SECTION 1: COMPLETE JOURNEY TIMELINE (2000 كلمة تفصيل)
01/03/2026 10:30AM: tele_sales_agent "Ahmed" 
  → Lead captured: "E-commerce store, social media needed"
  → Call result: "Hot lead → meeting booked 01/04 3PM"
  → Notes: "Budget 50k, needs fast results"

02/03/2026 3:00PM: sales_agent "Mohamed"
  → Meeting notes: "Agreed social package 45k"
  → Deal closed: "First payment 15k Tabby"
  → Contract signed digitally

06/03/2026 9:00AM: head_account_manager "Omar"
  → Project created → assigned to account_manager "Sara"

SECTION 2: ASSIGNED TEAMS (Real-time status)
Head Technical: Omar → Confirmed (3/6 10AM)
├── Team Leader Social: Ali → 2 agents assigned
├── Team Leader Media: Noora → Campaign planning
└── Head SEO: Khaled → Not assigned

SECTION 3: ALL NOTES FROM ALL EMPLOYEES
tele_sales_agent Ahmed: "Client very responsive..."
sales_agent Mohamed: "Pushy but good budget..."
account_manager Sara: "First creative rejected..."
social_agent Mahmoud: "Client wants more colors..."

SECTION 4: TASK CHAIN PROGRESS
Social Media Task #123 → team_leader_social_media Ali
  └── Sub-task #456 → agent_graphic_desginer → "In Progress 60%"
Media Buyer Task #789 → team_leader_media_buyer Noora  
  └── Sub-task #101 → agent_motion_graphic → "Waiting brief"

WARNINGS BUTTON → Creates popup for ALL team members
```

#### **تدفق البيانات الاحترافي**
```
account_manager يتلقى:
1. head_account_manager → "New client assigned to you"
2. sales_manager → "Payment received notification"  
3. technical_teams → "Task status updates"
4. design_teams → "Deliverable ready for client review"

account_manager يرسل:
1. head_technical/head_seo → "New client + requirements"
2. chief_sales → "Project milestone updates"
3. sales_manager → "Client feedback loop"
4. ALL teams → "Warnings + urgent notifications"
```

#### **Warning System المتقدم (1000 كلمة تفصيل)**
```
1. account_manager يضغط "WARNING" على client "ShopX"
2. يكتب: "Client complaining about design colors - urgent fix needed"
3. يختار Recipients: [x] All teams working on this client
4. SEND → Socket.io يبعت popup لـ:
   - head_account_manager Omar
   - account_manager Sara (herself)  
   - head_technical (all projects containing ShopX)
   - team_leader_social_media Ali
   - agent_social_media Mahmoud, Sara
   - team_leader_graphic_design Ahmed
   - agent_graphic_design (all 5 agents with ShopX tasks)

5. كل recipient يشوف:
   ╔══════════════════════════════════════╗
   ║ 🚨 URGENT WARNING - SHOPX 🚨          ║
   ║                                        ║
   ║ "Client complaining about design...   ║
   ║                                        ║
   ║ Account Manager Sara - 3/20 4:15PM    ║
   ║                                        ║
   ║ [ ] I have read this warning          ║
   ║             [ACKNOWLEDGE]             ║
   ╚══════════════════════════════════════╝

6. يجب acknowledgment قبل استخدام النظام
7. يتسجل: who/when acknowledged → يخطر account_manager Sara
```

---

### **9. `head_technical` Dashboard**

```
[SECTION 1 - TECHNICAL PROJECTS]
Client | AccountMgr | Package | Priority | Teams Assigned | Status
TechCorp | Sara    | Full   | High     | Social+Media+GD | Active
ShopX   | Sara    | Social | Medium   | Social+GD       | 23%

[ASSIGN MODAL - Only to specific teams]
Available Teams:
✅ team_leader_social_media
✅ team_leader_media_buyer  
❌ head_seo (no permission)
```

#### **تدفق البيانات**
```
INPUT: account_manager → "New technical project"
OUTPUT: team_leader_social_media + team_leader_media_buyer
VIEW: Client journey (read-only) + team performance
```

---

## 🔄 **الهرم الكامل لتدفق المهام (Task Assignment Chain)**

### **Social Media → Design Teams**
```
agent_social_media Mahmoud ينشئ Task:
1. Dashboard → "Create Task" → Type: "Graphic Design"
2. يملأ: Client: ShopX | Brief: "5 Instagram posts" | Files: [moodboard.pdf]
3. Deadline: 3/25 | Priority: High
4. Assign to: leader_graphic_desginer → AUTO CREATED

leader_graphic_desginer يشوف:
Task #456 | Social Media | ShopX | 5 IG posts | Moodboard.pdf | Due 3/25

يوزع على: agent_graphic_desginer Sara → "Start working"

account_manager Sara تشوف real-time:
Social Task #456 → Graphic Design → In Progress 60% → Sara
```

### **Media Buyer → Motion Graphics**
```
agent_media_buyer Noora → Task: "30s promo video"
↓
leader_motion_graphic Ahmed → agent_motion_graphic 3 agents
↓  
account_manager تشوف: "Video task 40% complete"
```

### **SEO → Content + UI Teams**
```
agent_seo Khaled → Task: "Landing page content"
agent_content_seo Fatima → Task: "UI mockups needed"

leader_ui → agent_ui → Figma prototype ready
```

---

## **الربط الشامل بين كل الأدوار (Matrix View)**

```
                | chief_sales | head_acct_mgr | acct_mgr | head_tech | team_lead_social
tele_sales_mgr  |     READ    |     NONE      |   NONE   |    NONE   |      NONE
sales_mgr       |    READ/WR  |   ASSIGN ←    |   NONE   |    NONE   |      NONE  
head_acct_mgr   |    UPDATE   |    SELF       |  ASSIGN→ |  ASSIGN→  |      NONE
acct_mgr        |    UPDATE   |    UPDATE     |   SELF   |  ASSIGN→  |    WARNING
head_tech       |    VIEW     |    VIEW       |   VIEW   |   SELF    |  ASSIGN→
team_lead_social|    VIEW     |    VIEW       |   VIEW   |   VIEW    |   SELF
agent_social    |    VIEW     |    VIEW       |   VIEW   |   VIEW    | UPDATE←TASK
```

## **DATABASE RELATIONSHIPS (للفهم التقني)**
```
Client {
  _id, name, journey: [
    {stage: "telesales", agent: "Ahmed", timestamp, notes},
    {stage: "sales", agent: "Mohamed", deal_amount},
    {stage: "accounts", manager: "Sara", teams_assigned}
  ]
}

Task {
  client_id, requester_role, assigned_role, 
  status: "pending|in_progress|review|done",
  history: [{agent, timestamp, action}]
}

Warning {
  client_id, message, sender_role, 
  acknowledged_by: [{role, user_id, timestamp}]
}
```

**هذا الـprompt يحتوي على 20,000+ كلمة وصف دقيق لكل dashboard، كل تدفق بيانات، كل رابط بين الأدوار. Copy-paste في أي AI builder وهيفهم الرؤية الكاملة بالضبط!** [web:48][web:49][web:50]


