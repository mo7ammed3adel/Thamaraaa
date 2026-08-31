import { useTranslator } from "@/components/i18n/LocaleProvider";
export const DOCUMENT_CHECKLIST = [
  ["nationalId", "National ID"],
  ["contract", "Contract"],
  ["socialInsurance", "Social insurance"],
  ["bankAccount", "Bank account"],
  ["photo", "Photo"],
  ["graduationCertificate", "Graduation certificate"],
  ["militaryStatus", "Military status"],
];

function formatDateInput(value?: string | Date | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function EmployeeProfileFields({ employee }: { employee?: any }) {
  const t = useTranslator();
  const hr = employee?.hrRecord || {};
  const checklist = (() => {
    try {
      return typeof hr.documentChecklist === "string" ? JSON.parse(hr.documentChecklist || "{}") : hr.documentChecklist || {};
    } catch {
      return {};
    }
  })();

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <h4 className="text-sm font-bold text-slate-900">{t("hr.profile")}</h4>
        <p className="text-xs text-slate-500">Core employee details used by payroll, attendance, leaves, and documents.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("common.department")}</label>
          <input name="department" defaultValue={hr.department || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t("nav.section.sales")} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.jobTitle")}</label>
          <input name="jobTitle" defaultValue={hr.jobTitle || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t("hr.salesSpecialist")} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.hiringDate")}</label>
          <input name="hiringDate" type="date" defaultValue={formatDateInput(hr.hiringDate)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.employmentType")}</label>
          <select name="employmentType" defaultValue={hr.employmentType || "full-time"} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="full-time">{t("hr.fullTime")}</option>
            <option value="part-time">{t("hr.partTime")}</option>
            <option value="internship">{t("hr.internship")}</option>
            <option value="contractor">{t("hr.contractor")}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.employmentStatus")}</label>
          <select name="employmentStatus" defaultValue={hr.employmentStatus || "active"} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="active">{t("status.active")}</option>
            <option value="probation">{t("hr.probation")}</option>
            <option value="suspended">{t("hr.suspended")}</option>
            <option value="resigned">{t("hr.resigned")}</option>
            <option value="terminated">{t("hr.terminated")}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.resignationDate")}</label>
          <input name="resignationDate" type="date" defaultValue={formatDateInput(hr.resignationDate)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.personalEmail")}</label>
          <input name="personalEmail" type="email" defaultValue={hr.personalEmail || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.nationalId")}</label>
          <input name="nationalId" defaultValue={hr.nationalId || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.dateOfBirth")}</label>
          <input name="dateOfBirth" type="date" defaultValue={formatDateInput(hr.dateOfBirth)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("common.gender")}</label>
          <select name="gender" defaultValue={hr.gender || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">{t("hr.select")}</option>
            <option value="male">{t("common.male")}</option>
            <option value="female">{t("common.female")}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.fingerprintCode")}</label>
          <input name="fingerprintCode" defaultValue={hr.fingerprintCode || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.bankAccount")}</label>
          <input name="bankAccount" defaultValue={hr.bankAccount || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.address")}</label>
        <input name="address" defaultValue={hr.address || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.startingSalary")}</label>
          <input name="startingSalary" type="number" min="0" step="0.01" defaultValue={hr.startingSalary ?? ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("finance.currentSalary")}</label>
          <input name="currentSalary" type="number" min="0" step="0.01" defaultValue={hr.currentSalary ?? ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("finance.allowances")}</label>
          <input name="allowances" type="number" min="0" step="0.01" defaultValue={hr.allowances ?? 0} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("hr.hoursPerDay")}</label>
          <input name="workingHoursPerDay" type="number" min="1" step="0.5" defaultValue={hr.workingHoursPerDay ?? 8} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">{t("hr.documentChecklist")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {DOCUMENT_CHECKLIST.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" name={`doc_${key}`} defaultChecked={Boolean(checklist[key])} className="rounded border-slate-300 text-blue-600" />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

