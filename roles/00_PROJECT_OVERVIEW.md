# 🏢 نظام ERP - إدارة علاقات العملاء الشاملة
## رؤية المشروع الكاملة

---

## 📌 نبذة عن المشروع

نظام ERP متكامل مصمم لشركة تسويق رقمي، يهدف إلى إدارة رحلة العميل بالكامل من لحظة دخوله كـ **Lead بارد** حتى تسليم الخدمة الكاملة وما بعدها، مع ربط كل الأقسام ببعضها في منظومة واحدة متكاملة وشفافة.

---

## 🛠️ التقنيات المستخدمة

- **Backend:** Node.js
- **المستخدمون المتوقعون:** ~500 مستخدم متزامن
- **النوع:** Web-based ERP / CRM System

---

## 🗺️ رحلة العميل الكاملة (Full Client Journey)

```
[Lead يدخل النظام]
        ↓
[TeleSales Agent] ← يتصل ويحدد نتيجة الاتصال
        ↓
[TeleSales Manager] ← يراقب ويوزع ويدير الفريق
        ↓
[Sales Agent] ← يعمل اجتماع ويحاول يغلق الصفقة
        ↓
[Sales Manager] ← يشرف ويتابع أداء الفريق
        ↓
[Chief Sales] ← إشراف عام على المبيعات كلها
        ↓
[Deal تتقفل] ← Project يتولد تلقائياً
        ↓
[Head Account Manager] ← يستلم العميل ويوزعه
        ↓
[Account Manager Agent] ← مسؤول مباشر عن العميل
        ↓
[Head Technical] ← يستلم التوزيع التقني
        ↓
┌─────────────────────────────────┐
│  Team Leader Social Media       │→ Social Media Agents
│  Team Leader Media Buyer        │→ Media Buyer Agents
│  Head SEO → Team Leader SEO     │→ SEO Agents → Content SEO Agents
└─────────────────────────────────┘
        ↓
[Design Tasks تتنزل من الـ Agents]
        ↓
┌─────────────────────────────────┐
│  Leader Graphic Design          │→ Graphic Design Agents
│  Leader Motion Graphic          │→ Motion Graphic Agents
│  Leader UI/UX                   │→ UI/UX Agents
└─────────────────────────────────┘
```

---

## 👥 جميع الأدوار داخل النظام (22 دور)

### قسم المبيعات الهاتفية
| الدور | الكود | الوصف |
|-------|-------|--------|
| موظف تيلي سيلز | `tele_sales_agent` | يتصل بالـ Leads ويحدد نتيجة الاتصال |
| مدير تيلي سيلز | `tele_sales_manager` | يدير ويوزع ويراقب فريق التيلي سيلز |

### قسم المبيعات
| الدور | الكود | الوصف |
|-------|-------|--------|
| موظف مبيعات | `sales_agent` | يعمل الاجتماعات ويغلق الصفقات |
| مدير مبيعات | `sales_manager` | يشرف على فريق المبيعات |
| شيف مبيعات | `chief_sales` | إشراف عام على قسمي TeleSales والمبيعات |

### قسم إدارة الحسابات
| الدور | الكود | الوصف |
|-------|-------|--------|
| هيد مدير حسابات | `head_account_manager` | يستلم العملاء بعد الصفقة ويوزعهم |
| مدير حسابات | `account_manager` | يتابع العميل ويشرف على تنفيذ الخدمة |

### القسم التقني
| الدور | الكود | الوصف |
|-------|-------|--------|
| هيد تكنيكال | `head_technical` | يشرف على الفرق التقنية كلها |
| هيد SEO | `head_seo` | يدير قسم السيو كامل |
| قائد فريق SEO | `team_leader_seo` | يقود ويوزع على موظفي السيو |
| موظف SEO | `agent_seo` | ينفذ مهام السيو |
| موظف Content SEO | `agent_content_seo` | يكتب محتوى السيو |
| قائد فريق Media Buyer | `team_leader_media_buyer` | يقود فريق الميديا باير |
| موظف Media Buyer | `agent_media_buyer` | ينفذ حملات الإعلانات |
| قائد فريق Social Media | `team_leader_social_media` | يقود فريق السوشيال ميديا |
| موظف Social Media | `agent_social_media` | ينفذ خطة السوشيال ميديا |

### قسم التصميم
| الدور | الكود | الوصف |
|-------|-------|--------|
| مدير Graphic Design | `leader_graphic_designer` | يوزع تاسكات التصميم على الفريق |
| موظف Graphic Design | `agent_graphic_designer` | ينفذ تصميمات الجرافيك |
| مدير Motion Graphic | `leader_motion_graphic` | يوزع تاسكات الموشن |
| موظف Motion Graphic | `agent_motion_graphic` | ينفذ الموشن جرافيك |
| مدير UI/UX | `leader_ui` | يوزع تاسكات تصميم الواجهات |
| موظف UI/UX | `agent_ui` | ينفذ تصميم الواجهات |

### أقسام الدعم
| الدور | الكود | الوصف |
|-------|-------|--------|
| مدير HR | `hr_manager` | إدارة الموارد البشرية |
| محاسب | `accountant` | إدارة الشؤون المالية |

---

## 🔑 المبادئ الأساسية للنظام

### 1. مبدأ الشفافية الكاملة (Full Transparency)
كل موظف دخل في شغل عميل يشوف رحلته الكاملة من أول ما دخل كـ Lead.

### 2. مبدأ التوزيع الهرمي (Hierarchical Distribution)
العميل بينزل دايماً من فوق لتحت، من الـ Head لـ Leader لـ Agent.

### 3. مبدأ الـ Task Flow
الـ Agents يقدروا يـ assign tasks للأقسام التانية (Design, Content) من خلال الداشبورد بتاعتهم مباشرة.

### 4. مبدأ الـ Warning System
أي تحذير على عميل يظهر كـ Pop-up إجباري عند كل موظف شغال على العميل ده ومش ممكن يتجاهله.

### 5. مبدأ الـ Closed Loop
رحلة العميل الكاملة متاحة للـ Sales Agent في الـ Deals بتاعته حتى بعد ما العميل راح لـ Account Management.

---

## 🏗️ الأقسام الجاهزة (لا يتم التعديل عليها)

> ⚠️ **تنبيه مهم:** الأقسام دي خلصت بالكامل ومضبوطة - ممنوع التعديل فيها

- ✅ **TeleSales Agent Dashboard** — جاهز بالكامل
- ✅ **TeleSales Manager Dashboard** — جاهز بالكامل
- ✅ **Sales Agent Dashboard** — جاهز بالكامل
- ✅ **Sales Manager Dashboard** — جاهز بالكامل

---

## 🚧 الأقسام المطلوب بناؤها

- 🔲 Chief Sales Dashboard
- 🔲 Head Account Manager Dashboard
- 🔲 Account Manager Dashboard
- 🔲 Head Technical Dashboard
- 🔲 Head SEO Dashboard
- 🔲 Team Leader SEO Dashboard
- 🔲 SEO Agent Dashboard
- 🔲 Content SEO Agent Dashboard
- 🔲 Team Leader Media Buyer Dashboard
- 🔲 Media Buyer Agent Dashboard
- 🔲 Team Leader Social Media Dashboard
- 🔲 Social Media Agent Dashboard
- 🔲 Leader Graphic Design Dashboard
- 🔲 Graphic Design Agent Dashboard
- 🔲 Leader Motion Graphic Dashboard
- 🔲 Motion Graphic Agent Dashboard
- 🔲 Leader UI/UX Dashboard
- 🔲 UI/UX Agent Dashboard
- 🔲 HR Manager Dashboard
- 🔲 Accountant Dashboard
- 🔲 Warning System (Global)
- 🔲 Client Journey Timeline (Global)
- 🔲 Task Assignment System (Cross-Department)

---

## 📊 الأنظمة المشتركة (Shared Systems)

### Client Journey Timeline
خط زمني كامل يظهر لكل موظف يضغط على عميل، يحتوي على:
- تاريخ دخول الـ Lead
- سجل مكالمات TeleSales + Notes
- تفاصيل اجتماعات Sales + Notes
- تفاصيل الصفقة والعقد
- توزيعات Account Management
- التاسكات التقنية وحالاتها

### Warning / Alert System
- أي `account_manager` أو `sales_agent` يضغط زرار Warning على عميل
- بوب-آب إجباري يظهر فوراً عند **كل موظف** شغال على العميل ده
- مينفعش يتقفل غير بعد الضغط على "تم قراءة التحذير"
- بعد القراءة يتسجل اسم الموظف + توقيت القراءة

### Task Assignment System
- Social Media / Media Buyer / SEO Agents يقدروا يـ assign tasks
- التاسك بيوصل للـ Leader المسؤول أولاً
- الـ Leader يوزع على الـ Agent
- حالات التاسك: `Pending → In Progress → Done`
- كل تاسك له: تاريخ الإنشاء، تاريخ البداية، تاريخ الانتهاء، رابط

---

*آخر تحديث: يناير 2025*
