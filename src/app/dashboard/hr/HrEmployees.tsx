"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, User2, Building2, Briefcase, Wallet, CalendarDays, FileWarning, Clock, Plane, ChevronRight, UserPlus } from "lucide-react";
import { notify } from "@/components/toast";
import { HttpError } from "@/client/transport/http";
import { createEmployee } from "@/client/api/hr";
import { buildLeaveSummary } from "@/lib/leaveAccrual";
import { computeSalaryReview } from "@/lib/salaryReview";
import { HR_DOC_LABELS } from "@/lib/hrOverview";
import HrSalaryEvalCard from "./HrSalaryEvalCard";

const CREATE_ROLES = [
  "sales_agent", "sales_manager", "tele_sales_agent", "tele_sales_manager",
  "account_manager", "head_account_manager", "head_seo", "team_leader_seo",
  "agent_seo", "agent_content_seo", "team_leader_social_media", "agent_social_media",
  "team_leader_media_buyer", "agent_media_buyer", "accountant", "hr_manager",
];
function genTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-GB");
}
function money(v?: number | null) {
  return v != null ? `SAR ${Number(v).toLocaleString()}` : "—";
}
function parseChecklist(json?: string | null): Record<string, boolean> {
  if (!json) return {};
  try { const p = JSON.parse(json); return p && typeof p === "object" ? p : {}; } catch { return {}; }
}
function statusTone(s?: string | null) {
  const v = (s || "").toLowerCase();
  if (["active", "approved", "paid"].includes(v)) return "bg-emerald-100 text-emerald-700";
  if (["pending", "suspended"].some((x) => v.includes(x))) return "bg-amber-100 text-amber-700";
  if (["rejected", "resigned", "terminated", "inactive"].includes(v)) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

export default function HrEmployees({ employees, departments, leaveRequests, salaryAdvances, complaints }: any) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);

  const deptNames: string[] = useMemo(
    () => Array.from(new Set([...(departments || []).map((d: any) => d.name), ...(employees || []).map((e: any) => e.hrRecord?.department).filter(Boolean)])),
    [departments, employees]
  );

  const empDept = (e: any) => e.hrRecord?.department || "—";

  const filtered = useMemo(
    () =>
      (employees || []).filter((e: any) => {
        const s = q.trim().toLowerCase();
        const matchQ = !s || e.name?.toLowerCase().includes(s) || e.email?.toLowerCase().includes(s) || (e.hrRecord?.employeeCode || "").toLowerCase().includes(s);
        const matchDept = dept === "all" || empDept(e) === dept;
        const matchStatus = status === "all" || (e.hrRecord?.employmentStatus || e.status || "active") === status;
        return matchQ && matchDept && matchStatus;
      }),
    [employees, q, dept, status]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or employee ID…" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
          <option value="all">All Departments</option>
          {deptNames.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none capitalize">
          <option value="all">All Statuses</option>
          {["active", "suspended", "resigned", "terminated"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate-400">{filtered.length} of {employees?.length || 0}</span>
        <button onClick={() => setShowCreate(true)} className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 shadow-sm">
          <UserPlus className="w-4 h-4" /> New Employee
        </button>
      </div>

      {showCreate && (
        <CreateEmployeeDrawer
          departments={departments}
          employees={employees}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); router.refresh(); }}
        />
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-left">Employee</th>
              <th className="px-6 py-3 text-left">Department</th>
              <th className="px-6 py-3 text-left">Role / Title</th>
              <th className="px-6 py-3 text-right">Salary</th>
              <th className="px-6 py-3 text-center">Status</th>
              <th className="px-6 py-3 text-right">Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filtered.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No employees match the filters.</td></tr>}
            {filtered.map((e: any) => (
              <tr key={e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(e)}>
                <td className="px-6 py-3">
                  <div className="font-bold text-slate-900">{e.name}</div>
                  <div className="text-xs text-slate-400">{e.hrRecord?.employeeCode || e.email}</div>
                </td>
                <td className="px-6 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">{empDept(e)}</span></td>
                <td className="px-6 py-3 text-slate-600">{e.hrRecord?.jobTitle || e.role?.replace(/_/g, " ")}</td>
                <td className="px-6 py-3 text-right text-slate-700">{money(e.hrRecord?.currentSalary ?? e.hrRecord?.baseSalary)}</td>
                <td className="px-6 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusTone(e.hrRecord?.employmentStatus || e.status)}`}>{e.hrRecord?.employmentStatus || e.status}</span></td>
                <td className="px-6 py-3 text-right"><span className="inline-flex items-center gap-1 text-blue-600 font-semibold text-xs">View <ChevronRight className="w-3.5 h-3.5" /></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ProfileDrawer
          employee={selected}
          departments={departments}
          onClose={() => setSelected(null)}
          leaveRequests={(leaveRequests || []).filter((r: any) => r.userId === selected.id)}
          salaryAdvances={(salaryAdvances || []).filter((a: any) => a.userId === selected.id)}
          complaints={(complaints || []).filter((c: any) => c.userId === selected.id)}
        />
      )}
    </div>
  );
}

function CreateEmployeeDrawer({ departments, employees, onClose, onCreated }: any) {
  const blank = {
    name: "", phone: "", gender: "Male", dateOfBirth: "",
    email: "", password: genTempPassword(), role: "sales_agent",
    department: "", directManagerId: "", baseSalary: "", hiringDate: "",
    employmentType: "full-time", workMode: "onsite", employmentStatus: "active",
  };
  const [form, setForm] = useState<any>(blank);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string; employeeCode?: string } | null>(null);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const cls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res: any = await createEmployee({
        name: form.name, email: form.email, password: form.password, role: form.role,
        phone: form.phone || null, gender: form.gender, dateOfBirth: form.dateOfBirth || null,
        department: form.department || null, directManagerId: form.directManagerId || null,
        baseSalary: form.baseSalary || 0, monthlyTarget: 0, level: "Junior",
        hiringDate: form.hiringDate || null, employmentType: form.employmentType,
        workMode: form.workMode, employmentStatus: form.employmentStatus,
        status: form.employmentStatus === "active" ? "Active" : "Inactive",
      });
      setCreated({ email: form.email, password: form.password, employeeCode: res?.user?.employeeCode });
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Failed to create employee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div className="w-full max-w-xl bg-slate-50 h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h3 className="font-black text-slate-900">New Employee</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        {created ? (
          <div className="p-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
              <p className="font-bold text-emerald-800">Employee created 🎉</p>
              <p className="text-sm text-emerald-700 mt-1">Share these credentials with the employee — the password is shown only once.</p>
              <div className="bg-white rounded-xl border mt-4 p-4 text-left space-y-2">
                {created.employeeCode && (
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Employee ID (username)</span><span className="font-mono font-bold text-slate-800">{created.employeeCode}</span></div>
                )}
                <div className="flex justify-between text-sm"><span className="text-slate-500">Email (also a username)</span><span className="font-mono font-bold text-slate-800">{created.email}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Temporary Password</span><span className="font-mono font-bold text-slate-800">{created.password}</span></div>
              </div>
              <p className="text-[11px] text-emerald-700 mt-2">The employee can sign in with either the Employee ID or their email, and will be asked to set a new password on first login.</p>
            </div>
            <button onClick={onCreated} className="w-full mt-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-5">
            <div className="bg-white rounded-2xl border p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Personal Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Full Name *</span><input required value={form.name} onChange={(e) => set("name", e.target.value)} className={cls} /></label>
                <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Mobile *</span><input required value={form.phone} onChange={(e) => set("phone", e.target.value)} className={cls} /></label>
                <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Gender</span><select value={form.gender} onChange={(e) => set("gender", e.target.value)} className={`${cls} bg-white`}><option>Male</option><option>Female</option></select></label>
                <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Date of Birth</span><input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} className={cls} /></label>
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Employment Information</h4>
              <p className="text-[11px] text-slate-400">Employee ID is generated automatically.</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Role *</span><select required value={form.role} onChange={(e) => set("role", e.target.value)} className={`${cls} bg-white capitalize`}>{CREATE_ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}</select></label>
                <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Department</span><select value={form.department} onChange={(e) => set("department", e.target.value)} className={`${cls} bg-white`}><option value="">— None —</option>{(departments || []).map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}</select></label>
                <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Direct Manager</span><select value={form.directManagerId} onChange={(e) => set("directManagerId", e.target.value)} className={`${cls} bg-white`}><option value="">— None —</option>{(employees || []).filter((m: any) => m.status === "Active").map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
                <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Monthly Salary (SAR)</span><input type="number" min="0" value={form.baseSalary} onChange={(e) => set("baseSalary", e.target.value)} className={cls} /></label>
                <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Hiring Date</span><input type="date" value={form.hiringDate} onChange={(e) => set("hiringDate", e.target.value)} className={cls} /></label>
                <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Work Type</span><select value={form.employmentType} onChange={(e) => set("employmentType", e.target.value)} className={`${cls} bg-white`}><option value="full-time">Full Time</option><option value="part-time">Part Time</option></select></label>
                <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Work Mode</span><select value={form.workMode} onChange={(e) => set("workMode", e.target.value)} className={`${cls} bg-white`}><option value="onsite">On Site</option><option value="remote">Remote</option></select></label>
                <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Employment Status</span><select value={form.employmentStatus} onChange={(e) => set("employmentStatus", e.target.value)} className={`${cls} bg-white capitalize`}>{["active", "suspended", "resigned", "terminated"].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Login Account</h4>
              <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Email (username) *</span><input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={cls} /></label>
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Temporary Password *</span>
                <div className="flex gap-2">
                  <input required value={form.password} onChange={(e) => set("password", e.target.value)} className={cls} />
                  <button type="button" onClick={() => set("password", genTempPassword())} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold whitespace-nowrap">Generate</button>
                </div>
              </label>
            </div>

            <div className="flex gap-3 pb-6">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">{saving ? "Creating…" : "Create Employee"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">{icon} {title}</h4>
      {children}
    </div>
  );
}
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-slate-50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800 text-right">{value ?? "—"}</span>
    </div>
  );
}
function Balance({ label, used, remaining, total, unit }: { label: string; used: number; remaining: number; total: number; unit: string }) {
  return (
    <div className="bg-slate-50 border rounded-xl p-3">
      <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
      <p className="text-xl font-black text-slate-800 mt-1">{remaining}<span className="text-xs font-medium text-slate-400"> {unit} left</span></p>
      <p className="text-[11px] text-slate-400 mt-0.5">{used} used{total ? ` · ${total} total` : ""}</p>
    </div>
  );
}

function ProfileDrawer({ employee, departments, onClose, leaveRequests, salaryAdvances, complaints }: any) {
  const hr = employee.hrRecord || {};
  const leave = buildLeaveSummary(hr.hiringDate, leaveRequests);

  const dept = (departments || []).find((d: any) => d.name === hr.department);
  let policy: any = {};
  if (dept) { try { policy = typeof dept.policy === "string" ? JSON.parse(dept.policy) : (dept.policy || {}); } catch { policy = {}; } }
  const review = computeSalaryReview(hr.hiringDate, policy);
  const salaryInfo = {
    currentSalary: hr.currentSalary ?? hr.baseSalary ?? 0,
    evaluationFrequency: review.evaluationFrequency,
    increaseType: review.increaseType,
    increaseValue: review.increaseValue,
    minEvalForIncrease: review.minEvalForIncrease,
    nextReviewDate: review.nextReviewDate ? review.nextReviewDate.toISOString() : null,
    daysUntilReview: review.daysUntilReview,
    nextEvaluationDate: review.nextEvaluationDate ? review.nextEvaluationDate.toISOString() : null,
    daysUntilEvaluation: review.daysUntilEvaluation,
    commission: { enabled: !!policy.commissionEnabled, type: policy.commissionType || "percentage", rules: policy.commissionRules || [] },
  };
  const checklist = parseChecklist(hr.documentChecklist);
  const isMale = (hr.gender || "").toLowerCase().startsWith("m");
  const docKeys = Object.keys(HR_DOC_LABELS).filter((k) => !(k === "militaryStatus" && !isMale));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div className="w-full max-w-2xl bg-slate-50 h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black">{employee.name?.[0]?.toUpperCase()}</span>
            <div>
              <h3 className="font-black text-slate-900">{employee.name}</h3>
              <p className="text-xs text-slate-500">{hr.employeeCode || employee.email} · {hr.jobTitle || employee.role?.replace(/_/g, " ")}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border p-4">
              <Section icon={<User2 className="w-3.5 h-3.5" />} title="Personal Information">
                <Field label="Mobile" value={employee.phone} />
                <Field label="Gender" value={hr.gender} />
                <Field label="Date of Birth" value={fmtDate(hr.dateOfBirth)} />
                <Field label="Personal Email" value={hr.personalEmail} />
                <Field label="National ID" value={hr.nationalId} />
                <Field label="Address" value={hr.address} />
              </Section>
            </div>
            <div className="bg-white rounded-2xl border p-4">
              <Section icon={<Briefcase className="w-3.5 h-3.5" />} title="Employment Information">
                <Field label="Employee ID" value={hr.employeeCode} />
                <Field label="Department" value={hr.department} />
                <Field label="Direct Manager" value={employee.directManager?.name} />
                <Field label="Hiring Date" value={fmtDate(hr.hiringDate)} />
                <Field label="Employment Type" value={hr.employmentType} />
                <Field label="Status" value={<span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusTone(hr.employmentStatus || employee.status)}`}>{hr.employmentStatus || employee.status}</span>} />
              </Section>
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-4">
            <Section icon={<Wallet className="w-3.5 h-3.5" />} title="Salary Information">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border rounded-xl p-3"><p className="text-[11px] font-bold uppercase text-slate-400">Current</p><p className="text-lg font-black text-slate-800">{money(hr.currentSalary ?? hr.baseSalary)}</p></div>
                <div className="bg-slate-50 border rounded-xl p-3"><p className="text-[11px] font-bold uppercase text-slate-400">Starting</p><p className="text-lg font-black text-slate-800">{money(hr.startingSalary ?? hr.baseSalary)}</p></div>
                <div className="bg-slate-50 border rounded-xl p-3"><p className="text-[11px] font-bold uppercase text-slate-400">Allowances</p><p className="text-lg font-black text-slate-800">{money(hr.allowances)}</p></div>
              </div>
            </Section>
          </div>

          <HrSalaryEvalCard info={salaryInfo} />

          <div className="bg-white rounded-2xl border p-4">
            <Section icon={<CalendarDays className="w-3.5 h-3.5" />} title={`Leave Summary ${leave.eligibleForAnnual ? "" : "(annual unlocks after 3 months)"}`}>
              <div className="grid grid-cols-3 gap-3">
                <Balance label="Annual Leave" used={leave.annual.used} remaining={leave.annual.remaining} total={leave.annual.accrued} unit="days" />
                <Balance label="Remote Days" used={leave.remote.used} remaining={leave.remote.remaining} total={leave.remote.allowance} unit="days" />
                <Balance label="Permission" used={leave.permission.used} remaining={leave.permission.remaining} total={leave.permission.allowance} unit="hrs" />
              </div>
            </Section>
          </div>

          <div className="bg-white rounded-2xl border p-4">
            <Section icon={<FileWarning className="w-3.5 h-3.5" />} title="Documents">
              <div className="grid grid-cols-2 gap-2">
                {docKeys.map((k) => (
                  <div key={k} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                    <span className="text-slate-600">{HR_DOC_LABELS[k]}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${checklist[k] ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{checklist[k] ? "Uploaded" : "Missing"}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <div className="bg-white rounded-2xl border p-4">
            <Section icon={<Clock className="w-3.5 h-3.5" />} title="History">
              <div className="space-y-2 text-sm">
                {[...leaveRequests.map((r: any) => ({ kind: r.type, status: r.status, date: r.date || r.startDate, label: `${r.type} request` })),
                  ...salaryAdvances.map((a: any) => ({ kind: "Advance", status: a.status, date: a.createdAt, label: `Salary advance · ${money(a.amount)}` })),
                  ...complaints.map((c: any) => ({ kind: "Complaint", status: c.status, date: c.createdAt, label: `Complaint · ${c.subject}` }))]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 12)
                  .map((h, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-1.5 last:border-0">
                      <span className="text-slate-700"><span className="font-semibold">{h.label}</span></span>
                      <span className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">{fmtDate(h.date)}</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${statusTone(h.status)}`}>{h.status}</span>
                      </span>
                    </div>
                  ))}
                {leaveRequests.length + salaryAdvances.length + complaints.length === 0 && <p className="text-slate-400 italic">No history yet.</p>}
              </div>
            </Section>
          </div>

          <div className="bg-white rounded-2xl border p-4">
            <Section icon={<Plane className="w-3.5 h-3.5" />} title="Activity Timeline">
              <ol className="relative border-l border-slate-200 ml-2 space-y-3">
                <li className="ml-4"><span className="absolute -left-1.5 w-3 h-3 rounded-full bg-blue-500" /><p className="text-sm font-semibold text-slate-800">Employee created</p><p className="text-xs text-slate-400">{fmtDate(employee.createdAt)}</p></li>
                {hr.hiringDate && <li className="ml-4"><span className="absolute -left-1.5 w-3 h-3 rounded-full bg-emerald-500" /><p className="text-sm font-semibold text-slate-800">Hiring date</p><p className="text-xs text-slate-400">{fmtDate(hr.hiringDate)}</p></li>}
                <li className="ml-4"><span className="absolute -left-1.5 w-3 h-3 rounded-full bg-slate-300" /><p className="text-sm text-slate-500">{leave.monthsWorked} month(s) with the company</p></li>
              </ol>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
