# 🏦 Head Account Manager — داشبورد هيد مدير الحسابات

---

## 🎯 الدور الوظيفي
الـ Head Account Manager هو أول نقطة استلام للعميل بعد إغلاق الصفقة. مسؤوليته توزيع العملاء على الـ Account Managers، والإشراف على سير الخدمة، وربط الفريق الحسابي بالفريق التقني.

---

## 🗂️ أقسام الداشبورد

---

### 1. 📊 Overview Dashboard

#### KPI Cards:
| البطاقة | الوصف |
|---------|--------|
| إجمالي العملاء النشطين | عدد العملاء اللي في مرحلة تنفيذ الخدمة |
| عملاء جدد في الانتظار | عملاء وصلوا بعد إغلاق الصفقة ولسه اتوزعوا |
| عملاء موزعين على Account Managers | عدد العملاء اللي عليهم Account Manager |
| عملاء بدون Account Manager | عملاء لسه في الانتظار |
| Warnings نشطة | عدد الـ Warnings اللي لسه لم تُحل |

---

### 2. 📥 Incoming Clients (العملاء الجدد)

#### جدول العملاء اللي وصلوا من Sales ولسه اتوزعوا:
| العمود | الوصف |
|--------|--------|
| اسم العميل | - |
| نوع الباقة | SEO / Social / Full |
| قيمة العقد | - |
| تاريخ إغلاق الصفقة | - |
| Sales Agent اللي أغلق | - |
| حالة التوزيع | Pending / Assigned |

> زرار **Assign** بجنب كل عميل → نافذة تختار منها الـ Account Manager المناسب

---

### 3. 👥 My Account Managers

#### جدول Account Managers تحت إشرافه:
| العمود | الوصف |
|--------|--------|
| اسم الـ Account Manager | - |
| عدد العملاء عنده | - |
| عملاء نشطين | - |
| عملاء بهم Warnings | - |
| آخر نشاط | - |

> الضغط على اسم الـ Account Manager → تفاصيل كل العملاء عنده + حالة كل مشروع

---

### 4. 📋 All Clients Overview

#### جدول كل العملاء تحت إشرافه (الكل):
| العمود | الوصف |
|--------|--------|
| اسم العميل | - |
| Account Manager المسؤول | - |
| نوع الباقة | - |
| حالة المشروع | Active / On Hold / Completed |
| التيم الشغال عليه | أيقونات Social / Media / SEO |
| آخر تحديث | - |
| Warnings | عدد الـ Warnings إن وجدت |

> الضغط على أي عميل → **Client Full Journey** كامل من TeleSales لحد الحالة الحالية

---

### 5. 🔧 Technical Assignment

#### توزيع العميل على الفريق التقني:
عند الضغط على عميل معين، يظهر قسم **Technical Assignment**:
- اختيار الـ Head Technical وتوزيع المشروع عليه
- عرض الفرق التقنية المخصصة للعميل ده (Social / Media Buyer / SEO)
- عرض حالة كل فريق (Not Started / In Progress / Active)

---

### 6. ⚠️ Warnings Center

- قائمة بكل الـ Warnings على العملاء تحت إشرافه
- اسم من أرسل الـ Warning (Sales أو Account Manager)
- نص التحذير
- قائمة من قرأ ومن لسه
- زرار إضافة Warning جديد على أي عميل

---

### 7. 📈 Performance Analytics

#### أداء Account Managers:
- عدد العملاء لكل واحد
- عدد الـ Warnings لكل واحد
- متوسط وقت الاستجابة لـ Warnings
- حالة المشاريع (Active / Completed / On Hold)

---

## 🔐 الصلاحيات

| الصلاحية | ✅/❌ |
|----------|------|
| استلام العملاء الجدد من Sales | ✅ |
| توزيع العملاء على Account Managers | ✅ |
| توزيع العميل على Head Technical | ✅ |
| مشاهدة رحلة العميل الكاملة | ✅ |
| إرسال Warning | ✅ |
| مشاهدة كل التاسكات التقنية | ✅ (Read Only) |
| تعديل بيانات العقد | ❌ |
| الوصول لداشبورد Sales أو TeleSales | ❌ |

---

## 🔔 الإشعارات التلقائية

- عميل جديد وصل من Sales جاهز للتوزيع
- Warning جديد على أي عميل تحت إشرافه
- Account Manager لم يتحرك على عميل منذ X أيام
- تاسك تقني اتأخر عن موعد التسليم


-------------------------------------------
Head Account Manager Dashboard (FULL SPEC)

Build a fully detailed, production-ready dashboard for the role: "Head Account Manager" inside a CRM + Task Management system.

The Head Account Manager is responsible for:
- Receiving clients from Sales
- Assigning clients to Account Manager Agents
- Assigning Head Technical
- Monitoring all clients at a high level
- Ensuring workflow is running correctly
- Tracking delays, issues, and performance

-------------------------------------
🔐 ROLE ACCESS & PERMISSIONS
-------------------------------------

- Can view ALL clients in the system
- Can assign clients to Account Manager Agents
- Can assign Head Technical
- Can reassign clients anytime
- Can view ALL tasks (read-only)
- Can view ALL notes
- Cannot create tasks
- Cannot directly interact with execution teams
- Cannot create warnings (optional: read-only warnings)

-------------------------------------
🖥️ MAIN DASHBOARD STRUCTURE
-------------------------------------

1) OVERVIEW SECTION (Top KPIs)

Display high-level metrics:

- Total Clients
- New Clients Today
- Clients Not Assigned
- Active Clients
- Delayed Clients (based on overdue tasks)
- Clients With Warnings
- Average Completion Rate
- Team Performance Summary

-------------------------------------

2) CLIENTS MASTER LIST (GLOBAL VIEW)

Table columns:

- Client Name
- Company Name
- Source (TeleSales / Sales)
- Assigned Account Manager
- Assigned Head Technical
- Current Status:
   (New / Assigned / Active / Delayed / On Hold)
- Progress Percentage
- Number of Active Tasks
- Number of Delayed Tasks
- Warning Indicator
- Last Activity Date

Features:
- Search by client/company
- Filter:
   - By Account Manager
   - By Status
   - By Warning
   - By Delay
- Sort by:
   - Progress
   - Last activity
   - Task count

-------------------------------------

3) CLIENT DETAILS PAGE (HIGH-LEVEL CONTROL)

Click any client → open detailed page:

-------------------------------------
A) CLIENT PROFILE
-------------------------------------

- Client Name
- Company Name
- Contact Info
- Industry
- Package / Service
- Budget (optional)
- Deal Close Date
- Assigned Account Manager
- Assigned Head Technical
- Status

-------------------------------------
B) FULL CLIENT TIMELINE
-------------------------------------

Display complete lifecycle:

- Lead creation (TeleSales)
- TeleSales interactions
- Sales interactions
- Deal closure
- Assignment to AM
- Technical assignments
- Task execution events

Each entry:
- Timestamp
- User
- Action
- Notes

-------------------------------------
C) NOTES VIEW (READ-ONLY)
-------------------------------------

Display all notes from all roles:

- TeleSales
- Sales
- Account Manager
- Technical Teams

Features:
- Filter by role
- Filter by date
- Search

-------------------------------------
D) TEAM ASSIGNMENT CONTROL
-------------------------------------

Controls:

- Assign Account Manager (Dropdown)
- Assign Head Technical (Dropdown)

Display:

- Current AM
- Current Technical Head
- All assigned teams (read-only)

-------------------------------------
E) TASKS OVERVIEW (READ-ONLY)
-------------------------------------

Display summarized tasks:

- Total Tasks
- Completed
- In Progress
- Pending
- Delayed

Task table:

- Task Title
- Type
- Assigned Team
- Assigned To
- Status
- Start Date
- Deadline
- Completion Date

Click → view full task details

-------------------------------------
F) PROGRESS & PERFORMANCE TRACKING
-------------------------------------

Display:

- Overall progress %
- Task completion rate
- Delay rate

Visuals:

- Progress bar
- Task distribution chart

-------------------------------------
G) WARNING VIEW (READ-ONLY)
-------------------------------------

Display all warnings related to the client:

- Message
- Created by
- Severity
- Date
- Read status across users

-------------------------------------
H) ACTIVITY LOG (FULL AUDIT)
-------------------------------------

Track all actions:

- Assignments
- Reassignments
- Task updates
- Notes
- Status changes

-------------------------------------

4) ASSIGNMENT MANAGEMENT PANEL

Quick actions:

- Assign new client → AM
- Assign technical head
- Bulk assign clients
- Reassign clients

-------------------------------------

5) PERFORMANCE DASHBOARD

Track Account Managers:

- Number of clients per AM
- Average progress per AM
- Delayed clients per AM
- Warning count per AM

Track Technical:

- Task completion rates
- Delay rates

-------------------------------------

6) ALERTS & MONITORING

- Clients with no activity for X days
- Clients with too many delayed tasks
- Clients with active warnings

-------------------------------------

-------------------------------------
🔁 SYSTEM BEHAVIOR RULES
-------------------------------------

- Head AM sees everything in real-time
- All updates are synced instantly
- Any assignment change updates instantly across system
- Data is centralized and shared

-------------------------------------

-------------------------------------
🔥 KEY REQUIREMENTS
-------------------------------------

- High-level control without micro-management
- Full visibility across all clients
- Easy assignment and reassignment
- Strong monitoring tools
- Clean SaaS UI

-------------------------------------

Build the system scalable, modular, and optimized for performance.