"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Plus, X, Trash2, Users, FileText, ExternalLink } from "lucide-react";
import { notify } from "@/components/toast";
import { HttpError } from "@/client/transport/http";
import {
  addDepartmentDocument, createDepartment, deleteDepartment, deleteDepartmentDocument,
  listDepartments, updateDepartment,
} from "@/client/api/departments";

import { useTranslator } from "@/components/i18n/LocaleProvider";
const DEFAULT_POLICY = {
  evaluationFrequency: "quarterly",
  passingScore: 70,
  salaryEligibilityScore: 80,
  evalStartRule: "after_probation",
  firstReviewMonths: 3,
  regularReviewMonths: 6,
  increaseType: "percentage",
  increaseValue: 10,
  minEvalForIncrease: 80,
  commissionEnabled: false,
  commissionType: "percentage",
  commissionRules: [] as { minSales: number; pct: number }[],
  probationMonths: 3,
};

const blankDept = () => ({ id: "", name: "", description: "", status: "active", headId: "", teamLeaderIds: [] as string[], policy: { ...DEFAULT_POLICY }, documents: [] as any[], employeeCount: 0 });

export default function HrDepartments({ employees = [] }: { employees?: any[] }) {
  const t = useTranslator();
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);

  const load = useCallback(() => {
    setLoading(true);
    listDepartments()
      .then((d: any) => setDepartments(d?.departments || []))
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openEdit = (d: any) => setEditing({ ...blankDept(), ...d, policy: { ...DEFAULT_POLICY, ...(d.policy || {}) }, teamLeaderIds: d.teamLeaderIds || [] });

  const remove = async (d: any) => {
    try {
      await deleteDepartment(d.id);
      notify(`Deleted "${d.name}"`);
      load();
    } catch (e) {
      notify(e instanceof HttpError ? e.message : "Failed to delete department");
    }
  };

  const empName = (id: string) => employees.find((e: any) => e.id === id)?.name || "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{departments.length} department(s)</p>
        <button onClick={() => setEditing(blankDept())} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> New Department
        </button>
      </div>

      {loading ? (
        <div className="bg-white border rounded-xl p-12 text-center text-slate-400">{t("hr.loadingDepartments")}</div>
      ) : departments.length === 0 ? (
        <div className="bg-white border border-dashed rounded-xl p-12 text-center text-slate-400">{t("hr.noDepartments")}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition cursor-pointer" onClick={() => openEdit(d)}>
              <div className="flex items-start justify-between mb-3">
                <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Building2 className="w-5 h-5" /></span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${d.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>{d.status}</span>
                  <button onClick={(e) => { e.stopPropagation(); remove(d); }} className="p-1 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="font-bold text-slate-900 text-lg">{d.name}</h3>
              {d.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{d.description}</p>}
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {d.employeeCount} employees</span>
                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {d.documents?.length || 0} docs</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Head: {empName(d.headId)}</p>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <DepartmentEditor
          editing={editing}
          setEditing={setEditing}
          employees={employees}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function P({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500";

function DepartmentEditor({ editing, setEditing, employees, onClose, onSaved }: any) {
  const t = useTranslator();
  const [saving, setSaving] = useState(false);
  const isNew = !editing.id;
  const setField = (k: string, v: any) => setEditing((p: any) => ({ ...p, [k]: v }));
  const setPolicy = (k: string, v: any) => setEditing((p: any) => ({ ...p, policy: { ...p.policy, [k]: v } }));

  const toggleTL = (id: string) =>
    setEditing((p: any) => ({ ...p, teamLeaderIds: p.teamLeaderIds.includes(id) ? p.teamLeaderIds.filter((x: string) => x !== id) : [...p.teamLeaderIds, id] }));

  const save = async () => {
    if (!editing.name.trim()) { notify("Department name is required"); return; }
    setSaving(true);
    const payload = {
      name: editing.name, description: editing.description, status: editing.status,
      headId: editing.headId || null, teamLeaderIds: editing.teamLeaderIds, policy: editing.policy,
    };
    try {
      if (isNew) {
        const res: any = await createDepartment(payload);
        setEditing({ ...editing, id: res.department.id }); // keep open for docs
        notify("Department created");
      } else {
        await updateDepartment(editing.id, payload);
        notify("Department updated");
      }
      onSaved();
    } catch (e) {
      notify(e instanceof HttpError ? e.message : "Failed to save department");
    } finally {
      setSaving(false);
    }
  };

  const addDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    try {
      const res: any = await addDepartmentDocument(editing.id, { name: fd.get("name"), fileUrl: fd.get("fileUrl") });
      setEditing((p: any) => ({ ...p, documents: [res.document, ...(p.documents || [])] }));
      form.reset();
      onSaved();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Failed to add document");
    }
  };
  const removeDoc = async (docId: string) => {
    try {
      await deleteDepartmentDocument(editing.id, docId);
      setEditing((p: any) => ({ ...p, documents: (p.documents || []).filter((d: any) => d.id !== docId) }));
      onSaved();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Failed to remove document");
    }
  };

  const pol = editing.policy;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div className="w-full max-w-2xl bg-slate-50 h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h3 className="font-black text-slate-900">{isNew ? "New Department" : editing.name}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Basic */}
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("hr.basicInfo")}</h4>
            <P label="Department Name *"><input value={editing.name} onChange={(e) => setField("name", e.target.value)} className={inputCls} /></P>
            <P label="Description"><textarea value={editing.description} onChange={(e) => setField("description", e.target.value)} rows={2} className={inputCls} /></P>
            <div className="grid grid-cols-2 gap-3">
              <P label="Department Head">
                <select value={editing.headId || ""} onChange={(e) => setField("headId", e.target.value)} className={`${inputCls} bg-white`}>
                  <option value="">— None —</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </P>
              <P label="Status">
                <select value={editing.status} onChange={(e) => setField("status", e.target.value)} className={`${inputCls} bg-white`}>
                  <option value="active">{t("status.active")}</option>
                  <option value="inactive">{t("status.inactive")}</option>
                </select>
              </P>
            </div>
            <P label="Team Leaders">
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto border rounded-lg p-2 bg-white">
                {employees.map((e: any) => (
                  <button key={e.id} type="button" onClick={() => toggleTL(e.id)} className={`text-xs px-2 py-1 rounded-full border ${editing.teamLeaderIds.includes(e.id) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>{e.name}</button>
                ))}
              </div>
            </P>
          </div>

          {/* Evaluation policy */}
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("hr.evaluationPolicy")}</h4>
            <div className="grid grid-cols-2 gap-3">
              <P label="Frequency">
                <select value={pol.evaluationFrequency} onChange={(e) => setPolicy("evaluationFrequency", e.target.value)} className={`${inputCls} bg-white`}>
                  {["monthly", "quarterly", "semiannual", "yearly"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </P>
              <P label="Passing Score %"><input type="number" value={pol.passingScore} onChange={(e) => setPolicy("passingScore", Number(e.target.value))} className={inputCls} /></P>
              <P label="Salary Eligibility Score %"><input type="number" value={pol.salaryEligibilityScore} onChange={(e) => setPolicy("salaryEligibilityScore", Number(e.target.value))} className={inputCls} /></P>
              <P label="Evaluation Start Rule">
                <select value={pol.evalStartRule} onChange={(e) => setPolicy("evalStartRule", e.target.value)} className={`${inputCls} bg-white`}>
                  <option value="after_probation">{t("hr.afterProbation")}</option>
                  <option value="from_hiring">{t("hr.fromHiringDate")}</option>
                </select>
              </P>
            </div>
          </div>

          {/* Salary increment policy */}
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("hr.incrementPolicy")}</h4>
            <div className="grid grid-cols-2 gap-3">
              <P label="First Review (months)"><input type="number" value={pol.firstReviewMonths} onChange={(e) => setPolicy("firstReviewMonths", Number(e.target.value))} className={inputCls} /></P>
              <P label="Regular Review (months)"><input type="number" value={pol.regularReviewMonths} onChange={(e) => setPolicy("regularReviewMonths", Number(e.target.value))} className={inputCls} /></P>
              <P label="Increase Type">
                <select value={pol.increaseType} onChange={(e) => setPolicy("increaseType", e.target.value)} className={`${inputCls} bg-white`}>
                  <option value="percentage">{t("hr.percentage")}</option>
                  <option value="fixed">{t("hr.fixedAmount")}</option>
                </select>
              </P>
              <P label={pol.increaseType === "fixed" ? "Increase Value (SAR)" : "Increase Value %"}><input type="number" value={pol.increaseValue} onChange={(e) => setPolicy("increaseValue", Number(e.target.value))} className={inputCls} /></P>
              <P label="Min Evaluation for Increase %"><input type="number" value={pol.minEvalForIncrease} onChange={(e) => setPolicy("minEvalForIncrease", Number(e.target.value))} className={inputCls} /></P>
              <P label="Probation (months)"><input type="number" value={pol.probationMonths} onChange={(e) => setPolicy("probationMonths", Number(e.target.value))} className={inputCls} /></P>
            </div>
          </div>

          {/* Commission policy */}
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("hr.commissionPolicy")}</h4>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={pol.commissionEnabled} onChange={(e) => setPolicy("commissionEnabled", e.target.checked)} /> Enabled
              </label>
            </div>
            {pol.commissionEnabled && (
              <>
                <P label="Commission Type">
                  <select value={pol.commissionType} onChange={(e) => setPolicy("commissionType", e.target.value)} className={`${inputCls} bg-white`}>
                    {["fixed", "percentage", "tier"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </P>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">{t("hr.tierRules")}</span>
                    <button type="button" onClick={() => setPolicy("commissionRules", [...(pol.commissionRules || []), { minSales: 0, pct: 0 }])} className="text-xs font-bold text-blue-600">+ Rule</button>
                  </div>
                  {(pol.commissionRules || []).map((r: any, i: number) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input type="number" value={r.minSales} onChange={(e) => setPolicy("commissionRules", pol.commissionRules.map((x: any, j: number) => j === i ? { ...x, minSales: Number(e.target.value) } : x))} placeholder={t("hr.minSales")} className="col-span-6 border rounded px-2 py-1 text-xs" />
                      <input type="number" step="0.1" value={r.pct} onChange={(e) => setPolicy("commissionRules", pol.commissionRules.map((x: any, j: number) => j === i ? { ...x, pct: Number(e.target.value) } : x))} placeholder="%" className="col-span-5 border rounded px-2 py-1 text-xs" />
                      <button type="button" onClick={() => setPolicy("commissionRules", pol.commissionRules.filter((_: any, j: number) => j !== i))} className="col-span-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Documents */}
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("hr.departmentDocuments")}</h4>
            {isNew ? (
              <p className="text-xs text-slate-400 italic">{t("hr.saveFirst")}</p>
            ) : (
              <>
                <form onSubmit={addDoc} className="grid grid-cols-12 gap-2">
                  <input name="name" required placeholder={t("hr.documentNameExample")} className="col-span-5 border rounded-lg px-2 py-1.5 text-xs" />
                  <input name="fileUrl" required type="url" placeholder="https://…" className="col-span-5 border rounded-lg px-2 py-1.5 text-xs" />
                  <button type="submit" className="col-span-2 bg-slate-900 text-white rounded-lg text-xs font-bold">{t("common.add")}</button>
                </form>
                <div className="space-y-1.5">
                  {(editing.documents || []).map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-1.5">
                      <span className="font-medium text-slate-700">{doc.name}</span>
                      <div className="flex items-center gap-2">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600"><ExternalLink className="w-3.5 h-3.5" /></a>
                        <button onClick={() => removeDoc(doc.id)} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                  {(editing.documents || []).length === 0 && <p className="text-xs text-slate-400 italic">{t("hr.noDocumentsYet")}</p>}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pb-6">
            <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200">{t("common.close")}</button>
            <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : isNew ? "Create Department" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
