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
        <h4 className="text-sm font-bold text-slate-900">HR Profile</h4>
        <p className="text-xs text-slate-500">Core employee details used by payroll, attendance, leaves, and documents.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Department</label>
          <input name="department" defaultValue={hr.department || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Sales" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Job Title</label>
          <input name="jobTitle" defaultValue={hr.jobTitle || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Sales Specialist" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Hiring Date</label>
          <input name="hiringDate" type="date" defaultValue={formatDateInput(hr.hiringDate)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Employment Type</label>
          <select name="employmentType" defaultValue={hr.employmentType || "full-time"} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="internship">Internship</option>
            <option value="contractor">Contractor</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Employment Status</label>
          <select name="employmentStatus" defaultValue={hr.employmentStatus || "active"} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="active">Active</option>
            <option value="probation">Probation</option>
            <option value="suspended">Suspended</option>
            <option value="resigned">Resigned</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Resignation Date</label>
          <input name="resignationDate" type="date" defaultValue={formatDateInput(hr.resignationDate)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Personal Email</label>
          <input name="personalEmail" type="email" defaultValue={hr.personalEmail || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">National ID</label>
          <input name="nationalId" defaultValue={hr.nationalId || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Date of Birth</label>
          <input name="dateOfBirth" type="date" defaultValue={formatDateInput(hr.dateOfBirth)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Gender</label>
          <select name="gender" defaultValue={hr.gender || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Fingerprint Code</label>
          <input name="fingerprintCode" defaultValue={hr.fingerprintCode || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Bank Account</label>
          <input name="bankAccount" defaultValue={hr.bankAccount || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
        <input name="address" defaultValue={hr.address || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Starting Salary</label>
          <input name="startingSalary" type="number" min="0" step="0.01" defaultValue={hr.startingSalary ?? ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Current Salary</label>
          <input name="currentSalary" type="number" min="0" step="0.01" defaultValue={hr.currentSalary ?? ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Allowances</label>
          <input name="allowances" type="number" min="0" step="0.01" defaultValue={hr.allowances ?? 0} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Hours/Day</label>
          <input name="workingHoursPerDay" type="number" min="1" step="0.5" defaultValue={hr.workingHoursPerDay ?? 8} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Document Checklist</p>
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

