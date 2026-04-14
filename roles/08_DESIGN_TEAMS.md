# 🎨 Design Teams — داشبوردات أقسام التصميم

---

## الأقسام المشمولة:
1. **Graphic Design** — `leader_graphic_designer` + `agent_graphic_designer`
2. **Motion Graphic** — `leader_motion_graphic` + `agent_motion_graphic`
3. **UI/UX Design** — `leader_ui` + `agent_ui`

---

> **مبدأ العمل الموحد:** الثلاث أقسام بيشتغلوا بنفس الطريقة تماماً.
> التاسكات بتيجي من (Social Media Agents / Media Buyer Agents / SEO Agents)
> بتوصل للـ Leader أول → الـ Leader يوزع على الـ Agent → الـ Agent ينفذ

---

# 🎨 1. Graphic Design Team

---

## Leader Graphic Design

### الدور الوظيفي
يستلم تاسكات التصميم الجرافيكي من كل الفرق، يوزعها على موظفين الجرافيك، ويتابع سير التنفيذ.

### 🗂️ أقسام الداشبورد

#### 1. 📊 Overview Dashboard

| KPI | الوصف |
|-----|--------|
| تاسكات واردة جديدة | Pending لسه ما اتوزعتش |
| تاسكات جارية | In Progress |
| تاسكات خلصت الأسبوع ده | Done |
| تاسكات متأخرة | تجاوزت الـ Deadline |
| Warnings نشطة | - |

---

#### 2. 📥 Incoming Tasks (التاسكات الواردة)

جدول التاسكات الجديدة اللي وصلت:
| العمود | الوصف |
|--------|--------|
| اسم التاسك | - |
| العميل المرتبط | - |
| من رفعه | Social Media / Media Buyer / SEO Agent |
| وصف التاسك | - |
| رابط المرجع | - |
| Deadline | - |
| حالة التوزيع | Pending |

> زرار **Assign to Agent** → نافذة اختيار Graphic Design Agent

---

#### 3. 👥 My Team

| العمود | الوصف |
|--------|--------|
| اسم الموظف | - |
| تاسكات عنده جارية | - |
| تاسكات خلصها | - |
| تاسكات متأخرة | - |
| آخر نشاط | - |

---

#### 4. 📊 All Tasks

جدول كل التاسكات في القسم:
| العمود | الوصف |
|--------|--------|
| اسم التاسك | - |
| العميل | - |
| من رفعه | - |
| Agent المسؤول | - |
| الحالة | Pending / In Progress / Done |
| تاريخ الاستلام | - |
| تاريخ البداية | - |
| تاريخ الانتهاء | - |
| Deadline | - |
| تأخير؟ | ✅/⚠️ |

---

#### 5. ⚠️ Warnings
- Pop-up إجباري على Warnings للعملاء اللي في تاسكاته

---

### 🔐 صلاحيات Leader Graphic Design

| الصلاحية | ✅/❌ |
|----------|------|
| استلام وتوزيع التاسكات على Agents | ✅ |
| مشاهدة معلومات العميل + Timeline | ✅ |
| مشاهدة كل تاسكات فريقه | ✅ |
| استقبال Warnings | ✅ |
| إرسال Warning | ❌ |
| رفع تاسكات لفرق تانية | ❌ |

---

## Agent Graphic Design

### الدور الوظيفي
ينفذ تاسكات التصميم الجرافيكي، يطلع على معلومات العميل لفهم متطلباته، ويحدّث حالة التاسك.

### 🗂️ أقسام الداشبورد

#### 1. 📊 Overview Dashboard

| KPI | الوصف |
|-----|--------|
| تاسكات في الانتظار | Pending |
| تاسكات جارية | In Progress |
| تاسكات خلصت | Done |
| تاسكات متأخرة | - |
| Warnings نشطة | - |

---

#### 2. 📋 My Tasks

| العمود | الوصف |
|--------|--------|
| اسم التاسك | - |
| العميل | - |
| من رفعه | - |
| الحالة | Pending / In Progress / Done |
| وصف التاسك | - |
| رابط المرجع | - |
| تاريخ الاستلام | - |
| Deadline | - |

> **زرار Start Task** → حالة تبقى In Progress + تاريخ البداية يتسجل
> **زرار Mark Done** → حالة تبقى Done + تاريخ الانتهاء يتسجل + يظهر للـ Leader والـ Account Manager

---

#### 3. 👁️ Client Info

عند الضغط على تاسك:
- اسم العميل + المجال + رابط المتجر
- Client Journey Timeline (للاطلاع)
- Notes الكاملة من كل الأقسام (للاستفادة في فهم العميل)

---

#### 4. ⚠️ Warnings
- Pop-up إجباري على Warnings للعملاء اللي في تاسكاته

---

### 🔐 صلاحيات Agent Graphic Design

| الصلاحية | ✅/❌ |
|----------|------|
| مشاهدة تاسكاته فقط | ✅ |
| مشاهدة معلومات العميل + Timeline | ✅ |
| قراءة كل Notes | ✅ |
| تحديث حالة تاسكاته | ✅ |
| استقبال Warnings | ✅ |
| توزيع تاسكات | ❌ |
| إرسال Warning | ❌ |

---
---

# 🎬 2. Motion Graphic Team

> نفس الـ structure بالضبط مع Graphic Design Team، مع تغيير اسم القسم للـ Motion Graphic

### الفرق الوحيد:
- التاسكات اللي بتيجي هي تاسكات Motion Graphic (مقاطع فيديو، animations، إلخ)
- من نفس المصادر: Social Media Agents / Media Buyer Agents / SEO Agents

### Leader Motion Graphic — نفس صلاحيات وداشبورد Leader Graphic Design
### Agent Motion Graphic — نفس صلاحيات وداشبورد Agent Graphic Design

---
---

# 🖥️ 3. UI/UX Design Team

> نفس الـ structure بالضبط مع Graphic Design Team، مع تغيير اسم القسم للـ UI/UX

### الفرق الوحيد:
- التاسكات اللي بتيجي هي تاسكات تصميم الواجهات (Landing pages, App UI, Store Design, إلخ)
- من نفس المصادر: Social Media Agents / Media Buyer Agents / SEO Agents

### Leader UI/UX — نفس صلاحيات وداشبورد Leader Graphic Design
### Agent UI/UX — نفس صلاحيات وداشبورد Agent Graphic Design

---

## 📌 ملخص مقارنة أقسام التصميم

| الجانب | Graphic Design | Motion Graphic | UI/UX |
|--------|---------------|----------------|-------|
| نوع العمل | تصميم ثابت | فيديو / animation | واجهات مستخدم |
| مصدر التاسكات | Social / Media / SEO | Social / Media / SEO | Social / Media / SEO |
| يمر عبر Leader؟ | ✅ | ✅ | ✅ |
| يشوف Timeline العميل؟ | ✅ | ✅ | ✅ |
| يقدر يرفع تاسكات؟ | ❌ | ❌ | ❌ |
| يستقبل Warnings؟ | ✅ | ✅ | ✅ |




----------------------------------
Team Leader Graphic Design


Build dashboard for "Team Leader Graphic Design".

Responsibilities:
- Receive tasks
- Assign to designers

-------------------------------------

FEATURES:
- Task queue
- Assign designers

-------------------------------------
GOAL:
-------------------------------------
Distribute design workload






------------------


Graphic Designer Agent:

Build dashboard for "Graphic Designer".

Responsibilities:
- Execute designs

-------------------------------------

FEATURES:
- Task list
- Update status:
   Pending / In Progress / Done
- View notes

-------------------------------------
GOAL:
-------------------------------------
Deliver designs on time





Motion Graphics Agent:
--
Build dashboard for "Motion Graphics".

Responsibilities:
- Execute videos

-------------------------------------

FEATURES:
- Task list
- Status updates

-------------------------------------
GOAL:
-------------------------------------
Deliver motion content





--------------------


UI/UX Team:

Build dashboard for "UI/UX Team".

Responsibilities:
- Execute UI/UX tasks

-------------------------------------

FEATURES:
- Task list
- Design tracking

-------------------------------------
GOAL:
-------------------------------------
Deliver UI/UX improvements



--------------------------------------

