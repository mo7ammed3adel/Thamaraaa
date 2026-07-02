import { useState } from "react";
import { Briefcase, Building2, FileText, ShieldAlert, WalletCards } from "lucide-react";

const WARNING_TYPES = ["attendance", "administrative", "technical", "performance", "behavioral"];
const ADVANCE_STATUSES = ["pending_accountant", "approved", "rejected", "paid", "deducted"];
const PAYROLL_STATUSES = ["Pending review", "Approved", "Published", "Locked", "Reopened"];

export function Overview({ data }: { data: any }) {
  const stats = data.overview || {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi label="Employees" value={stats.employees} icon={<Briefcase className="w-5 h-5" />} />
        <Kpi label="Active" value={stats.activeEmployees} icon={<Briefcase className="w-5 h-5" />} tone="green" />
        <Kpi label="Departments" value={stats.departments} icon={<Building2 className="w-5 h-5" />} />
        <Kpi label="Open complaints" value={stats.openComplaints} icon={<ShieldAlert className="w-5 h-5" />} tone="amber" />
        <Kpi label="Pending advances" value={stats.pendingAdvances} icon={<WalletCards className="w-5 h-5" />} tone="amber" />
        <Kpi label="Recruiting" value={stats.openRecruitment} icon={<FileText className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DataPanel title="Payroll Workflow">
          <SimpleTable
            columns={["Month", "Status", "Entries", "Net"]}
            rows={(data.payrollPeriods || []).slice(0, 6).map((period: any) => [
              period.month,
              statusBadge(period.status),
              period.entries?.length || 0,
              money(sum(period.entries || [], "netSalary")),
            ])}
          />
        </DataPanel>
        <DataPanel title="Recent People Signals">
          <SimpleTable
            columns={["Type", "Employee", "Status"]}
            rows={[
              ...(data.salaryAdvances || []).slice(0, 3).map((row: any) => ["Advance", row.employeeName, statusBadge(row.status)]),
              ...(data.complaints || []).slice(0, 3).map((row: any) => ["Complaint", row.employeeName, statusBadge(row.status)]),
              ...(data.exits || []).slice(0, 3).map((row: any) => ["Exit", row.employeeName, statusBadge(row.archiveStatus)]),
            ]}
          />
        </DataPanel>
      </div>
    </div>
  );
}

export function Profiles({ employees }: { employees: any[] }) {
  return (
    <DataPanel title="Employee Profiles">
      <SimpleTable
        columns={["Code", "Employee", "Department", "Job title", "Type", "Status", "Salary", "Docs"]}
        rows={employees.map((employee) => {
          const checklist = parseJson(employee.hrRecord?.documentChecklist, {});
          return [
            employee.hrRecord?.employeeCode || "-",
            <div key={employee.id}><div className="font-bold text-gray-900">{employee.name}</div><div className="text-xs text-gray-500">{employee.email}</div></div>,
            employee.displayDepartment,
            employee.displayJobTitle,
            employee.hrRecord?.employmentType || "-",
            statusBadge(employee.hrRecord?.employmentStatus || employee.status),
            money(employee.hrRecord?.currentSalary ?? employee.hrRecord?.baseSalary ?? 0),
            `${Object.values(checklist).filter(Boolean).length}/${Object.keys(checklist).length || 7}`,
          ];
        })}
      />
    </DataPanel>
  );
}

export function Departments({ departments, busy, onCreate, onDelete }: any) {
  return (
    <TwoColumn>
      <DataPanel title="Create Department">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onCreate("department", formValues(e.currentTarget), e.currentTarget);
          }}
        >
          <Field name="name" label="Department name" required />
          <Select name="parentId" label="Parent department" options={[["", "None"], ...departments.map((d: any) => [d.id, d.name])]} />
          <PrimaryButton disabled={busy}>Create Department</PrimaryButton>
        </form>
      </DataPanel>
      <DataPanel title="Department Tree">
        <SimpleTable
          columns={["Department", "Parent", "Employees", ""]}
          rows={departments.map((dept: any) => [
            dept.name,
            departments.find((d: any) => d.id === dept.parentId)?.name || "-",
            dept.employeeCount || 0,
            <button key={dept.id} onClick={() => onDelete("department", dept.id)} className="text-xs font-bold text-red-600">Delete</button>,
          ])}
        />
      </DataPanel>
    </TwoColumn>
  );
}

export function PayrollPeriods({ data, month, busy, onCreate, onUpdate }: any) {
  const periods = data.payrollPeriods || [];
  const active = periods.find((period: any) => period.month === month) || periods[0];
  return (
    <div className="space-y-5">
      <DataPanel title="Generate Payroll Period">
        <form
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onCreate("payrollPeriod", formValues(e.currentTarget), e.currentTarget);
          }}
        >
          <Field name="month" label="Month" type="month" defaultValue={month} required />
          <Field name="bonusSubmissionDeadline" label="Bonus deadline" type="date" />
          <Field name="notes" label="Notes" />
          <div className="flex items-end"><PrimaryButton disabled={busy}>Generate</PrimaryButton></div>
        </form>
      </DataPanel>

      <DataPanel title="Periods">
        <SimpleTable
          columns={["Month", "Status", "Generated", "Entries", "Net", "Actions"]}
          rows={periods.map((period: any) => [
            period.month,
            statusBadge(period.status),
            formatDate(period.generatedAt),
            period.entries?.length || 0,
            money(sum(period.entries || [], "netSalary")),
            <div key={period.id} className="flex flex-wrap gap-1">
              {PAYROLL_STATUSES.map((status) => (
                <button key={status} onClick={() => onUpdate("payrollPeriodStatus", { id: period.id, status })} className="px-2 py-1 text-[11px] font-bold bg-slate-100 rounded">
                  {status}
                </button>
              ))}
            </div>,
          ])}
        />
      </DataPanel>

      {active && (
        <DataPanel title={`Entries - ${active.month}`}>
          <SimpleTable
            columns={["Employee", "Base", "Allow.", "Bonus", "Commission", "Deduct.", "Warnings", "Net"]}
            rows={(active.entries || []).map((entry: any) => [
              <div key={entry.id}><div className="font-bold">{entry.employeeName}</div><div className="text-xs text-gray-500">{entry.department}</div></div>,
              money(entry.baseSalary),
              money(entry.allowances),
              money(entry.bonus + entry.manualBonus),
              money(entry.commission),
              money(entry.attendanceDeduction + entry.absenceDeduction + entry.manualDeduction + entry.advanceDeduction),
              money(entry.warningDeduction),
              <span key={entry.id} className="font-black">{money(entry.netSalary)}</span>,
            ])}
          />
        </DataPanel>
      )}
    </div>
  );
}

export function Advances({ employees, advances, busy, onCreate, onUpdate }: any) {
  return (
    <TwoColumn>
      <DataPanel title="Request Salary Advance">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("salaryAdvance", formValues(e.currentTarget), e.currentTarget); }}>
          <EmployeeSelect employees={employees} />
          <Field name="amount" label="Amount" type="number" required />
          <Field name="reason" label="Reason" required />
          <PrimaryButton disabled={busy}>Create Advance</PrimaryButton>
        </form>
      </DataPanel>
      <DataPanel title="Advance Workflow">
        <SimpleTable
          columns={["Employee", "Amount", "Status", "Actions"]}
          rows={advances.map((advance: any) => [
            advance.employeeName,
            money(advance.amount),
            statusBadge(advance.status),
            <div key={advance.id} className="flex flex-wrap gap-1">
              {ADVANCE_STATUSES.map((status) => (
                <button key={status} onClick={() => onUpdate("salaryAdvance", { id: advance.id, status })} className="px-2 py-1 text-[11px] font-bold bg-slate-100 rounded">
                  {status.replace(/_/g, " ")}
                </button>
              ))}
            </div>,
          ])}
        />
      </DataPanel>
    </TwoColumn>
  );
}

export function Recruitment({ departments, requests, busy, onCreate, onUpdate, onDelete }: any) {
  return (
    <TwoColumn>
      <DataPanel title="Create Recruitment Request">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("recruitmentRequest", formValues(e.currentTarget), e.currentTarget); }}>
          <Field name="positionTitle" label="Position title" required />
          <Select name="departmentName" label="Department" options={departments.map((d: any) => [d.name, d.name])} />
          <Select name="level" label="Level" options={["intern", "junior", "mid-level", "senior", "team leader", "manager", "head"].map((v) => [v, v])} />
          <Field name="minExperience" label="Minimum experience" />
          <Field name="requiredStartDate" label="Required start date" type="date" />
          <Field name="vacancies" label="Vacancies" type="number" defaultValue="1" />
          <PrimaryButton disabled={busy}>Create Request</PrimaryButton>
        </form>
      </DataPanel>
      <DataPanel title="Pipeline">
        <SimpleTable
          columns={["Position", "Department", "Level", "Vacancies", "Status", "Actions"]}
          rows={requests.map((req: any) => [
            req.positionTitle,
            req.departmentName || "-",
            req.level,
            req.vacancies,
            statusBadge(req.status),
            <div key={req.id} className="flex gap-2">
              {["in progress", "candidate selected", "hired", "closed"].map((status) => (
                <button key={status} onClick={() => onUpdate("recruitmentRequest", { id: req.id, status })} className="text-xs font-bold text-blue-700">{status}</button>
              ))}
              <button onClick={() => onDelete("recruitmentRequest", req.id)} className="text-xs font-bold text-red-600">Delete</button>
            </div>,
          ])}
        />
      </DataPanel>
    </TwoColumn>
  );
}

export function Kpis({ departments, templates, busy, onCreate, onUpdate, onDelete }: any) {
  const [editing, setEditing] = useState<any>(null);

  return (
    <TwoColumn>
      <DataPanel title={editing ? `New Version — ${editing.name} (currently v${editing.version})` : "Create KPI Template"}>
        <form key={editing?.id || "new"} className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const raw = formValues(e.currentTarget);
          const items = [1, 2, 3, 4, 5, 6].map((i) => ({
            name: raw[`item${i}`],
            weight: Number(raw[`weight${i}`]) || 0,
            description: raw[`description${i}`],
          })).filter((item) => item.name);
          if (editing) {
            onUpdate("kpiTemplate", { id: editing.id, name: raw.name, targetRole: raw.targetRole, departmentName: raw.departmentName, items });
            setEditing(null);
          } else {
            onCreate("kpiTemplate", { ...raw, items }, e.currentTarget);
          }
        }}>
          <Field name="name" label="Template name" required defaultValue={editing?.name || ""} />
          <Select name="departmentName" label="Department" options={[["", "All"], ...departments.map((d: any) => [d.name, d.name])]} />
          <Select name="targetRole" label="Target role" options={[["employee", "Employee"], ["team_leader", "Team Leader"]]} />
          {[1, 2, 3, 4, 5, 6].map((i) => {
            const item = editing?.items?.[i - 1];
            return (
              <div key={i} className="grid grid-cols-5 gap-2">
                <input name={`item${i}`} defaultValue={item?.name || ""} placeholder={`KPI item ${i}`} className="col-span-2 border rounded-lg px-3 py-2 text-sm" />
                <input name={`weight${i}`} type="number" defaultValue={item?.weight ?? ""} placeholder="Weight" className="border rounded-lg px-3 py-2 text-sm" />
                <input name={`description${i}`} defaultValue={item?.description || ""} placeholder="Description" className="col-span-2 border rounded-lg px-3 py-2 text-sm" />
              </div>
            );
          })}
          <p className="text-[11px] text-gray-400">Weights must total 100%. Saving a new version keeps every previous version intact, so completed evaluations stay linked to the structure they were scored against.</p>
          <div className="flex gap-2">
            <PrimaryButton disabled={busy}>{editing ? "Save New Version" : "Create Template"}</PrimaryButton>
            {editing && <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold">Cancel</button>}
          </div>
        </form>
      </DataPanel>
      <DataPanel title="Templates (latest versions)">
        <SimpleTable
          columns={["Template", "Dept", "Role", "Items", "Weight", "Version", "Actions"]}
          rows={templates.map((template: any) => [
            template.name,
            template.departmentName || "All",
            template.targetRole,
            template.items?.length || 0,
            `${sum(template.items || [], "weight")}%`,
            <span key={`v-${template.id}`} className="text-xs font-bold text-slate-700">v{template.version}{template.versionCount > 1 ? ` · ${template.versionCount} versions` : ""}</span>,
            <div key={`a-${template.id}`} className="flex gap-2 flex-wrap">
              <button onClick={() => setEditing(template)} className="text-xs font-bold text-emerald-700">New version</button>
              <button onClick={() => onUpdate("kpiTemplate", { id: template.id, active: !template.active })} className="text-xs font-bold text-blue-700">
                {template.active ? "Deactivate" : "Activate"}
              </button>
              <button onClick={() => onDelete("kpiTemplate", template.id)} className="text-xs font-bold text-red-600">Delete</button>
            </div>,
          ])}
        />
      </DataPanel>
    </TwoColumn>
  );
}

export function DevicePasswords({ employees, entries, busy, onCreate, onDelete }: any) {
  return (
    <TwoColumn>
      <DataPanel title="Set / Update Device Password">
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const raw = formValues(e.currentTarget);
          onCreate("devicePassword", raw, e.currentTarget);
        }}>
          <EmployeeSelect employees={employees} />
          <Field name="password" label="Device / computer password" required />
          <p className="text-[11px] text-gray-400">Only the latest password is stored — saving again replaces the previous one (no history). Employees cannot view this after it is set; this module is visible to HR only.</p>
          <PrimaryButton disabled={busy}>Save Password</PrimaryButton>
        </form>
      </DataPanel>
      <DataPanel title="Device Passwords (HR only)">
        <SimpleTable
          columns={["Employee", "Code", "Device Password", "Last Updated", "Actions"]}
          rows={(entries || []).map((entry: any) => [
            entry.employeeName,
            entry.employeeCode || "-",
            <span key={`p-${entry.id}`} className="font-mono text-slate-800">{entry.password}</span>,
            new Date(entry.updatedAt).toLocaleString(),
            <button key={`d-${entry.id}`} onClick={() => onDelete("devicePassword", entry.id)} className="text-xs font-bold text-red-600">Delete</button>,
          ])}
        />
      </DataPanel>
    </TwoColumn>
  );
}

export function PeopleOps({ employees, data, busy, onCreate, onUpdate, onDelete }: any) {
  const [mode, setMode] = useState("complaints");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["complaints", "warnings", "exits", "contracts", "assets"].map((item) => (
          <button key={item} onClick={() => setMode(item)} className={`px-3 py-2 rounded-lg text-sm font-bold ${mode === item ? "bg-slate-900 text-white" : "bg-white border text-gray-600"}`}>
            {item}
          </button>
        ))}
      </div>

      {mode === "complaints" && (
        <TwoColumn>
          <DataPanel title="Submit Complaint">
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("complaint", formValues(e.currentTarget), e.currentTarget); }}>
              <EmployeeSelect employees={employees} />
              <Field name="subject" label="Subject" required />
              <TextArea name="details" label="Details" required />
              <Select name="visibility" label="Visibility" options={["hr_only", "manager_only", "dept_head_only", "all_involved"].map((v) => [v, v.replace(/_/g, " ")])} />
              <PrimaryButton disabled={busy}>Create Complaint</PrimaryButton>
            </form>
          </DataPanel>
          <DataPanel title="Complaints">
            <SimpleTable columns={["Employee", "Subject", "Status", "Actions"]} rows={(data.complaints || []).map((row: any) => [
              row.employeeName,
              row.subject,
              statusBadge(row.status),
              ["in progress", "resolved", "closed"].map((status) => (
                <button key={status} onClick={() => onUpdate("complaint", { id: row.id, status })} className="mr-2 text-xs font-bold text-blue-700">{status}</button>
              )),
            ])} />
          </DataPanel>
        </TwoColumn>
      )}

      {mode === "warnings" && (
        <TwoColumn>
          <DataPanel title="Issue Warning">
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("warning", formValues(e.currentTarget), e.currentTarget); }}>
              <EmployeeSelect employees={employees} />
              <Select name="type" label="Type" options={WARNING_TYPES.map((v) => [v, v])} />
              <Field name="date" label="Date" type="date" required />
              <TextArea name="description" label="Description" required />
              <Field name="payrollDeduction" label="Payroll deduction" type="number" defaultValue="0" />
              <PrimaryButton disabled={busy}>Issue Warning</PrimaryButton>
            </form>
          </DataPanel>
          <DataPanel title="Warnings">
            <SimpleTable columns={["Employee", "Type", "Date", "Deduction", ""]} rows={(data.warnings || []).map((row: any) => [
              row.employeeName,
              row.type,
              formatDate(row.date),
              money(row.payrollDeduction),
              <button key={row.id} onClick={() => onDelete("warning", row.id)} className="text-xs font-bold text-red-600">Delete</button>,
            ])} />
          </DataPanel>
        </TwoColumn>
      )}

      {mode === "exits" && (
        <TwoColumn>
          <DataPanel title="Start Exit Process">
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("employeeExit", formValues(e.currentTarget), e.currentTarget); }}>
              <EmployeeSelect employees={employees} />
              <Select name="exitType" label="Exit type" options={[["resignation", "Resignation"], ["termination", "Termination"]]} />
              <Field name="submissionDate" label="Submission date" type="date" required />
              <Field name="lastWorkingDay" label="Last working day" type="date" />
              <Field name="requiredNoticeDays" label="Required notice days" type="number" defaultValue="30" />
              <TextArea name="exitInterviewNotes" label="Exit interview notes" />
              <PrimaryButton disabled={busy}>Create Exit</PrimaryButton>
            </form>
          </DataPanel>
          <DataPanel title="Exit Cases">
            <SimpleTable columns={["Employee", "Type", "Last day", "Clearance", "Archive", "Actions"]} rows={(data.exits || []).map((row: any) => [
              row.employeeName,
              row.exitType,
              formatDate(row.lastWorkingDay),
              statusBadge(row.clearanceStatus),
              statusBadge(row.archiveStatus),
              <button key={row.id} onClick={() => onUpdate("employeeExit", { id: row.id, clearanceStatus: "completed", finalSalaryStatus: "completed", archiveStatus: "archived" })} className="text-xs font-bold text-blue-700">Archive</button>,
            ])} />
          </DataPanel>
        </TwoColumn>
      )}

      {mode === "contracts" && (
        <TwoColumn>
          <DataPanel title="Add Contract">
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("contract", formValues(e.currentTarget), e.currentTarget); }}>
              <EmployeeSelect employees={employees} />
              <Field name="title" label="Title" required />
              <Field name="startDate" label="Start date" type="date" required />
              <Field name="endDate" label="End date" type="date" />
              <Field name="fileUrl" label="Signed file URL" />
              <PrimaryButton disabled={busy}>Add Contract</PrimaryButton>
            </form>
          </DataPanel>
          <DataPanel title="Contracts">
            <SimpleTable columns={["Employee", "Title", "Start", "End", ""]} rows={(data.contracts || []).map((row: any) => [
              row.employeeName,
              row.title,
              formatDate(row.startDate),
              formatDate(row.endDate),
              <button key={row.id} onClick={() => onDelete("contract", row.id)} className="text-xs font-bold text-red-600">Delete</button>,
            ])} />
          </DataPanel>
        </TwoColumn>
      )}

      {mode === "assets" && (
        <TwoColumn>
          <DataPanel title="Assign Asset">
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("asset", formValues(e.currentTarget), e.currentTarget); }}>
              <EmployeeSelect employees={employees} />
              <Field name="assetType" label="Asset type" required />
              <TextArea name="notes" label="Notes" />
              <PrimaryButton disabled={busy}>Assign Asset</PrimaryButton>
            </form>
          </DataPanel>
          <DataPanel title="Assets">
            <SimpleTable columns={["Employee", "Asset", "Returned", "Actions"]} rows={(data.assets || []).map((row: any) => [
              row.employeeName,
              row.assetType,
              row.returned ? "Yes" : "No",
              <button key={row.id} onClick={() => onUpdate("asset", { id: row.id, returned: !row.returned })} className="text-xs font-bold text-blue-700">Toggle return</button>,
            ])} />
          </DataPanel>
        </TwoColumn>
      )}
    </div>
  );
}

export function Settings({ settings, busy, onUpdate }: any) {
  const keys = [
    ["hr_contact_name", "HR contact name"],
    ["company_name", "Company name"],
    ["months_between_evaluations", "Months between evaluations"],
    ["leave_eligibility_days", "Leave eligibility days"],
    ["leave_accrual_rate_per_month", "Leave accrual / month"],
  ];
  return (
    <DataPanel title="HRM Settings">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {keys.map(([key, label]) => (
          <form key={key} className="flex items-end gap-2" onSubmit={(e) => {
            e.preventDefault();
            const values = formValues(e.currentTarget);
            onUpdate("setting", { key, value: values.value });
          }}>
            <Field name="value" label={label} defaultValue={settings[key] || ""} />
            <button disabled={busy} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">Save</button>
          </form>
        ))}
      </div>
    </DataPanel>
  );
}

function Kpi({ label, value, icon, tone = "slate" }: { label: string; value: number; icon: React.ReactNode; tone?: "slate" | "green" | "amber" }) {
  const cls = tone === "green" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : tone === "amber" ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-gray-200 text-gray-900";
  return (
    <div className={`border rounded-xl p-4 ${cls}`}>
      <div className="flex items-center justify-between mb-3">{icon}<span className="text-2xl font-black">{value || 0}</span></div>
      <p className="text-xs font-bold uppercase tracking-widest opacity-70">{label}</p>
    </div>
  );
}

export function DataPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="font-bold text-gray-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function TwoColumn({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">{children}</div>;
}

export function SimpleTable({ columns, rows }: { columns: string[]; rows: any[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>{columns.map((col) => <th key={col} className="px-3 py-2 text-left font-bold">{col}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400 italic">No records yet.</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">{row.map((cell, j) => <td key={j} className="px-3 py-3 align-top">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Field({ name, label, type = "text", required = false, defaultValue = "" }: any) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-gray-600 mb-1">{label}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
    </label>
  );
}

export function TextArea({ name, label, required = false }: any) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-gray-600 mb-1">{label}</span>
      <textarea name={name} required={required} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
    </label>
  );
}

export function Select({ name, label, options }: { name: string; label: string; options: any[] }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-gray-600 mb-1">{label}</span>
      <select name={name} className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
        {options.map((option) => {
          const [value, text] = Array.isArray(option) ? option : [option, option];
          return <option key={value} value={value}>{text}</option>;
        })}
      </select>
    </label>
  );
}

export function EmployeeSelect({ employees }: { employees: any[] }) {
  return <Select name="userId" label="Employee" options={employees.map((employee) => [employee.id, `${employee.name} - ${employee.hrRecord?.employeeCode || employee.role}`])} />;
}

export function PrimaryButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return <button disabled={disabled} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">{children}</button>;
}

export function statusBadge(status?: string | null) {
  const value = String(status || "-");
  return <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 capitalize">{value.replace(/_/g, " ")}</span>;
}

export function formValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

export function parseJson(raw: string | null | undefined, fallback: any) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function sum(rows: any[], key: string) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

export function money(value: number) {
  return `SAR ${(Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatDate(value?: string | Date | null) {
  return value ? new Date(value).toLocaleDateString() : "-";
}
