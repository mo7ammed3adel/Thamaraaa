# 👤 Account Manager — داشبورد مدير الحسابات

---

## 🎯 الدور الوظيفي
الـ Account Manager هو المسؤول المباشر عن متابعة العميل بعد إغلاق الصفقة. يشوف كل تفاصيل رحلة العميل، يوزع على الفريق التقني، ويتابع التاسكات، ويدير العلاقة مع العميل بشكل مستمر.

---

## 🗂️ أقسام الداشبورد

---

### 1. 📊 Overview Dashboard

#### KPI Cards:
| البطاقة | الوصف |
|---------|--------|
| إجمالي عملائي النشطين | عدد العملاء المسؤول عنهم |
| عملاء بـ Warnings نشطة | عملاء عندهم شكاوى لسه اتحلتش |
| تاسكات قيد التنفيذ | تاسكات In Progress على عملائه |
| تاسكات متأخرة | تاسكات تجاوزت موعد التسليم |
| تاسكات خلصت الأسبوع ده | - |

---

### 2. 📋 My Clients (عملائي)

#### جدول كل عملائه:
| العمود | الوصف |
|--------|--------|
| اسم العميل | - |
| نوع الباقة | SEO / Social / Full |
| تاريخ بداية الخدمة | - |
| حالة المشروع | Active / On Hold / Completed |
| الفريق الشغال | أيقونات Social / Media / SEO |
| تاسكات نشطة | عدد التاسكات الجارية |
| Warnings | عدد الـ Warnings النشطة |
| آخر تحديث | - |

> الضغط على أي عميل → صفحة تفاصيل العميل الكاملة

---

### 3. 👁️ Client Detail Page (صفحة العميل)

عند الضغط على أي عميل يظهر:

#### أ) معلومات العميل الأساسية:
- الاسم، نوع الباقة، قيمة العقد، تاريخ البداية والنهاية
- رابط المتجر / البيزنس
- المجال / النيش
- نوع البيزنس (دروبشيبينغ / لانش / إلخ)

#### ب) Client Journey Timeline (الخط الزمني الكامل):
```
📅 [تاريخ] دخل كـ Lead
    └─ TeleSales Agent: [الاسم]
    └─ ملاحظات الاتصال: [النصوص]
    └─ حالة الاتصال: [حجز اجتماع / إلخ]

📅 [تاريخ] اجتماع Sales
    └─ Sales Agent: [الاسم]
    └─ ملاحظات الاجتماع: [النصوص]
    └─ تقييم العميل: [نوع البيزنس / متجر صريح؟]

📅 [تاريخ] إغلاق الصفقة
    └─ نوع الباقة: [SEO/Social/Full]
    └─ قيمة العقد: [المبلغ]
    └─ طريقة الدفع: [نقد/تحويل/أقساط]

📅 [تاريخ] تم التوزيع على Account Manager
    └─ Account Manager: [الاسم]

📅 [تاريخ] توزيع على الفريق التقني
    └─ الفرق المعينة: [Social / Media / SEO]
    └─ Tasks مرتبطة
```

#### ج) Notes الشاملة:
- كل الملاحظات اللي كتبها كل موظف على العميل (TeleSales, Sales, Account Manager, Technical Team)
- مرتبة زمنياً من الأقدم للأحدث
- اسم كاتب الملاحظة + تاريخها

#### د) التيم الشغال على العميل:
- أسماء كل موظف مخصص للعميل ده
- قسمه ودوره
- حالة شغله (Active / Not Started)

#### هـ) Tasks Dashboard للعميل ده:
جدول بكل التاسكات المرتبطة بالعميل:
| العمود | الوصف |
|--------|--------|
| اسم التاسك | - |
| من رفعه | Agent اللي نزّل التاسك |
| ذاهب لـ | Graphic / Motion / UI / Content SEO |
| تاريخ الإنشاء | - |
| تاريخ البداية | - |
| تاريخ الانتهاء | - |
| الحالة | Pending / In Progress / Done |
| رابط التاسك | - |

---

### 4. ✅ Task Assignment (تنزيل تاسك)

#### نافذة إنشاء تاسك جديد:
- اختيار العميل المرتبط بالتاسك
- نوع التاسك:
  - `Content SEO` → يروح لـ Content SEO Team
  - `Graphic Design` → يروح لـ Leader Graphic Design
  - `Motion Graphic` → يروح لـ Leader Motion Graphic
  - `UI/UX Design` → يروح لـ Leader UI/UX
- وصف التاسك بالتفصيل
- رابط مرجعي (اختياري)
- Deadline المطلوب

> بعد الإرسال، التاسك يروح للـ Leader المسؤول اللي يوزعه على الـ Agent

---

### 5. ⚠️ Warning System

#### إرسال Warning:
- زرار **⚠️ Warning** ظاهر في صفحة كل عميل
- نافذة تكتب فيها تفاصيل الشكوى أو المشكلة
- بعد الإرسال → بوب-آب إجباري يظهر عند كل موظف شغال على العميل ده

#### استقبال Warnings:
- كل Warning على أي عميل من عملائه يظهر كـ Pop-up إجباري فور دخوله الداشبورد
- لازم يضغط "تم القراءة" عشان يكمل
- بعد القراءة يتسجل اسمه + الوقت

---

### 6. 📝 Notes (ملاحظاتي)

- إمكانية إضافة ملاحظة على أي عميل في أي وقت
- الملاحظات دي تظهر في الـ Timeline الكاملة للعميل

---

## 🔐 الصلاحيات

| الصلاحية | ✅/❌ |
|----------|------|
| مشاهدة عملائه فقط | ✅ |
| مشاهدة رحلة العميل الكاملة | ✅ |
| إرسال Warning | ✅ |
| تنزيل تاسكات للتصميم والـ Content | ✅ |
| توزيع العميل على Head SEO | ✅ |
| مشاهدة كل التاسكات للعميل | ✅ |
| تعديل بيانات العقد | ❌ |
| توزيع على Account Managers تانيين | ❌ |
| الوصول لعملاء Account Managers تانيين | ❌ |

---

## 🔔 الإشعارات التلقائية

- عميل جديد اتوزع عليه
- Warning جديد على أحد عملائه
- تاسك تغيرت حالته (Started / Done)
- تاسك تجاوز الـ Deadline


----------------
Account Manager Agent Dashboard (FULL SPEC)
:

Build a highly detailed and production-ready dashboard for the role: "Account Manager Agent" inside a full CRM + Task Management system.

The Account Manager Agent is responsible for:
- Managing assigned clients
- Viewing full client lifecycle
- Assigning technical teams
- Monitoring all tasks
- Communicating internally via notes
- Handling client complaints via warning system

-------------------------------------
🔐 ROLE ACCESS & PERMISSIONS
-------------------------------------

- Can ONLY view clients assigned to them
- Can view FULL client lifecycle (from TeleSales to execution)
- Can assign:
   - Head Technical
   - SEO (Head SEO or SEO Agent depending on structure)
- Can view ALL tasks related to their clients
- Can create warnings (critical system feature)
- Cannot assign tasks directly to designers or agents (only through team leaders)

-------------------------------------
🖥️ MAIN DASHBOARD STRUCTURE
-------------------------------------

1) OVERVIEW SECTION (Top Cards)

Display real-time statistics:

- Total Assigned Clients
- Active Clients
- Clients With Issues (warnings active)
- Total Tasks Across Clients
- Tasks In Progress
- Tasks Delayed (past deadline)
- Recent Activities Feed

-------------------------------------

2) CLIENTS LIST VIEW

Display a table of all assigned clients with:

Columns:
- Client Name
- Company Name
- Industry
- Current Status:
   (New / Assigned / Active / Delayed / On Hold)
- Progress Percentage (auto-calculated)
- Number of Active Tasks
- Number of Completed Tasks
- Warning Indicator (icon if exists)
- Last Activity Date

Features:
- Search by name / company
- Filter by status
- Sort by last activity / progress

Clicking a client opens FULL CLIENT DETAILS PAGE

-------------------------------------

3) CLIENT DETAILS PAGE (CORE OF SYSTEM)

This page must be extremely detailed and include:

-------------------------------------
A) CLIENT PROFILE
-------------------------------------

- Client Name
- Company Name
- Phone / Email
- Industry
- Package / Service Purchased
- Budget (optional)
- Start Date
- Current Status

-------------------------------------
B) FULL CLIENT TIMELINE (CRITICAL)
-------------------------------------

Display a vertical timeline showing:

- Lead created (TeleSales)
- Calls made by TeleSales
- Notes written by TeleSales
- Transfer to Sales
- Sales interactions
- Deal closing date
- Assignment to Account Manager
- All activities afterward

Each timeline item must include:
- Date & Time
- Action Type
- User who performed it
- Notes (if any)

-------------------------------------
C) NOTES SYSTEM (GLOBAL & SHARED)
-------------------------------------

Display ALL notes from:

- TeleSales
- Sales
- Account Managers
- Technical Teams

Features:
- Filter by role
- Filter by date
- Search notes

Add Note:
- Text field
- Optional attachments
- Save with timestamp + user info

-------------------------------------
D) TEAM ASSIGNMENT SECTION
-------------------------------------

Allow Account Manager to assign teams:

Fields:
- Assign Head Technical (Dropdown)
- Assign SEO (Dropdown)

Display assigned team:

- Head Technical
- Social Media Team (auto once assigned)
- Media Buyer Team
- SEO Team

-------------------------------------
E) TASK MANAGEMENT & TRACKING (VERY IMPORTANT)
-------------------------------------

Display ALL tasks related to the client.

Task Table:

- Task Title
- Task Type:
   (Design / Motion / Content / Ads / UI/UX / SEO)
- Assigned By
- Assigned To
- Related Team
- Status:
   (Pending / In Progress / Hold / Done)
- Priority (Low / Medium / High)
- Start Date
- Deadline
- Completion Date
- Delay Indicator (if overdue)

Click Task → open Task Details:

-------------------------------------
TASK DETAILS VIEW
-------------------------------------

- Full description
- Attachments / Links
- Activity log (status changes)
- Comments (internal team discussion)

-------------------------------------
F) PROGRESS TRACKING SYSTEM
-------------------------------------

Display:

- Overall Progress % (based on completed tasks)
- Tasks Summary:
   - Total
   - Completed
   - Pending
   - Delayed

Visual:
- Progress bar
- Pie chart (optional)

-------------------------------------
G) WARNING SYSTEM (CRITICAL FEATURE)
-------------------------------------

Allow Account Manager to create a WARNING.

Form:

- Warning Message (required)
- Severity:
   (Low / Medium / High)
- Optional attachments

On submit:

- Send real-time popup notification to:
   - All assigned team members
   - All team leaders
   - Head Technical
   - Designers, Motion, UI/UX, etc.

-------------------------------------
WARNING POPUP RULES
-------------------------------------

- Popup must block the screen
- User cannot continue until clicking:
   "Mark as Read"

System must log:
- Who received it
- Who read it
- Timestamp

-------------------------------------
H) ACTIVITY LOG
-------------------------------------

Track EVERYTHING:

- Assignments
- Task creation
- Task updates
- Notes
- Warnings

-------------------------------------

4) TASK MONITORING PANEL (GLOBAL)

Show tasks across ALL assigned clients:

Filters:
- Client
- Status
- Team
- Date

-------------------------------------

5) NOTIFICATIONS PANEL

- Task updates
- New notes
- Warnings
- Assignment changes

-------------------------------------

-------------------------------------
🔁 SYSTEM BEHAVIOR RULES
-------------------------------------

- All data must be synced across all roles
- Any update reflects instantly for all users related to the client
- Every action must be logged
- No hidden data between teams

-------------------------------------

-------------------------------------
🔥 KEY REQUIREMENTS
-------------------------------------

- Full transparency of client lifecycle
- Real-time updates
- Strong hierarchy-based permissions
- Centralized data
- Scalable architecture

-------------------------------------

Build the UI clean, modern, and suitable for SaaS CRM platforms.