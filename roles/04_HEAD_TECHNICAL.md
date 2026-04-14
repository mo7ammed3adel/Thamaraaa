# ⚙️ Head Technical — داشبورد هيد التكنيكال

---

## 🎯 الدور الوظيفي
الـ Head Technical مسؤول عن استلام المشاريع من الـ Head Account Manager وتوزيعها على فرق التنفيذ (Social Media وMedia Buyer). يشرف على سير العمل التقني ويتأكد إن كل فريق شغال على العملاء المخصصين ليه.

> **ملاحظة:** Head SEO يعمل بشكل مستقل تحت إشراف Account Manager مباشرة، مش Head Technical.

---

## 🗂️ أقسام الداشبورد

---

### 1. 📊 Overview Dashboard

#### KPI Cards:
| البطاقة | الوصف |
|---------|--------|
| إجمالي المشاريع النشطة | عدد العملاء اللي بيتشتغل عليهم |
| مشاريع في الانتظار | عملاء وصلوا ولسه اتوزعوا على فرق |
| تاسكات نشطة | عدد التاسكات In Progress في كل الفرق |
| تاسكات متأخرة | تاسكات تجاوزت الـ Deadline |
| Warnings نشطة | عدد الـ Warnings على عملاء تحت إشرافه |

---

### 2. 📥 Incoming Projects

#### جدول العملاء اللي وصلوا ولسه اتوزعوا:
| العمود | الوصف |
|--------|--------|
| اسم العميل | - |
| نوع الباقة | Social / Full |
| Account Manager المسؤول | - |
| تاريخ الاستلام | - |
| حالة التوزيع | Pending / Assigned |

> زرار **Assign** → نافذة اختيار الفرق المطلوبة (Social Media / Media Buyer أو كلاهما حسب الباقة)

---

### 3. 👥 My Teams

#### عرض الفرق تحت إشرافه:

**فريق Social Media:**
| العمود | الوصف |
|--------|--------|
| Team Leader | اسمه |
| عدد الأعضاء | - |
| عدد العملاء النشطين | - |
| تاسكات جارية | - |
| تاسكات متأخرة | - |

**فريق Media Buyer:**
| العمود | الوصف |
|--------|--------|
| Team Leader | اسمه |
| عدد الأعضاء | - |
| عدد العملاء النشطين | - |
| تاسكات جارية | - |
| تاسكات متأخرة | - |

> الضغط على أي فريق → تفاصيل كل الأعضاء وكل العملاء والتاسكات

---

### 4. 📋 All Projects Overview

#### جدول كل المشاريع تحت إشرافه:
| العمود | الوصف |
|--------|--------|
| اسم العميل | - |
| الفريق المعين | Social / Media Buyer / كلاهما |
| Team Leader المسؤول | - |
| Agent المسؤول | - |
| حالة المشروع | Active / On Hold / Completed |
| تاسكات نشطة | عدد التاسكات |
| Warnings | - |

> الضغط على أي عميل → Client Journey Timeline الكاملة + كل التاسكات

---

### 5. 📊 Tasks Overview

#### جدول كل التاسكات على مستوى كل فرقه:
| العمود | الوصف |
|--------|--------|
| اسم التاسك | - |
| العميل المرتبط | - |
| من رفعه | - |
| ذاهب لـ | Graphic / Motion / UI |
| الحالة | Pending / In Progress / Done |
| تاريخ الإنشاء | - |
| Deadline | - |
| تأخير؟ | ✅/⚠️ |

---

### 6. ⚠️ Warnings Center

- استقبال الـ Warnings على العملاء تحت إشرافه كـ Pop-up إجباري
- قائمة بكل الـ Warnings النشطة
- اسم من أرسلها + تاريخ + النص
- حالة القراءة لكل موظف

---

## 🔐 الصلاحيات

| الصلاحية | ✅/❌ |
|----------|------|
| استلام المشاريع من Head Account Manager | ✅ |
| توزيع المشاريع على Team Leader Social Media | ✅ |
| توزيع المشاريع على Team Leader Media Buyer | ✅ |
| مشاهدة رحلة العميل الكاملة | ✅ |
| مشاهدة كل تاسكات فرقه | ✅ |
| استقبال Warnings | ✅ |
| إرسال Warning | ❌ |
| التوزيع على Head SEO | ❌ |
| الوصول لداشبورد Sales أو TeleSales | ❌ |

---

## 🔔 الإشعارات التلقائية

- مشروع جديد وصل من Head Account Manager
- Warning جديد على عميل تحت إشرافه
- تاسك تجاوز الـ Deadline في أي فريق
- Team Leader لم يحدث حالة عميل منذ X أيام
----------------------------------------
Head Technical Dashboard (FULL SPEC)

Build a fully detailed, production-ready dashboard for the role: "Head Technical" inside a CRM + Task Management system.

Responsibilities:
- Receive clients from Account Manager
- Assign clients to:
   - Team Leader Social Media
   - Team Leader Media Buyer
- Monitor execution progress
- Ensure tasks are moving correctly

-------------------------------------
PERMISSIONS
-------------------------------------

- View assigned clients only
- Assign clients to team leaders
- View all tasks (read-only)
- View all notes
- Cannot create tasks
- Cannot create warnings

-------------------------------------
DASHBOARD
-------------------------------------

1) Overview:
- Assigned Clients
- Active Clients
- Delayed Clients
- Tasks In Progress

2) Clients List:
- Client Name
- Assigned Teams
- Status
- Progress %
- Delays

3) Client Details:
- Timeline
- Notes (read-only)
- Teams assigned

4) Assignment:
- Assign Social Media TL
- Assign Media Buyer TL

5) Tasks Overview:
- Read-only tasks
- Status tracking

-------------------------------------
KEY GOAL:
-------------------------------------
Distribute workload across teams efficiently