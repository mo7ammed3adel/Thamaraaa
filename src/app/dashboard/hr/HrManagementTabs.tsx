import { useState, useEffect, useCallback } from "react";
import { notify } from "@/components/toast";
import { useRouter } from "next/navigation";
import { UserX, Award, AlertTriangle, FileText, Plus, Trash2, X, Check } from "lucide-react";
import { HttpError } from "@/client/transport/http";
import {
  createApplicant,
  createDocument,
  deleteDocument,
  listApplicants,
  listDocuments,
  listHrRequests,
  listPromotionEvaluations,
  runAutoEvaluations,
  runPromotionAction,
  updateApplicant,
  updateHrRequest,
} from "@/client/api/hr";

export function PromotionEngineTab() {
  const router = useRouter();
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "promote" | "warn" | "terminate">("all");

  const load = useCallback(() => {
    setLoading(true);
    listPromotionEvaluations()
      .then((d: any) => setEvaluations(d.evaluations || []))
      .catch(() => setEvaluations([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAction = async (e: any, action: string) => {
    if (action === "terminate" && !confirm(`Terminate ${e.userName}? This will mark the account inactive.`)) return;
    if (action === "promote" && !confirm(`Promote ${e.userName} to ${e.nextLevel || ""} ${e.nextRole ? `(${e.nextRole.replace(/_/g, " ")})` : ""}?`)) return;
    setBusy(e.userId);
    try {
      await runPromotionAction({ userId: e.userId, action, nextLevel: e.nextLevel, nextRole: e.nextRole });
      load();
      router.refresh();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const runAutoEval = async () => {
    if (!confirm("Run the auto-evaluation against all HrRecords? This updates promotionEligible / warningCount / terminationFlag.")) return;
    await runAutoEvaluations();
    load();
  };

  const filtered = evaluations.filter((e) => filter === "all" || e.recommendation === filter);
  const counts = {
    promote: evaluations.filter((e) => e.recommendation === "promote").length,
    warn: evaluations.filter((e) => e.recommendation === "warn").length,
    terminate: evaluations.filter((e) => e.recommendation === "terminate").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2 flex items-center gap-2"><Award className="w-4 h-4"/> Eligible to Promote</p>
          <p className="text-3xl font-black text-emerald-700">{counts.promote}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Warning (50–70%)</p>
          <p className="text-3xl font-black text-amber-700">{counts.warn}</p>
        </div>
        <div className="bg-red-50 border border-red-200 p-5 rounded-2xl">
          <p className="text-xs font-bold text-red-700 uppercase tracking-widest mb-2 flex items-center gap-2"><UserX className="w-4 h-4"/> At Risk (&lt;50%)</p>
          <p className="text-3xl font-black text-red-700">{counts.terminate}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl flex flex-col justify-between">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Auto-Evaluate</p>
          <button onClick={runAutoEval} className="text-xs px-3 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition">
            Run 3-Month Eval
          </button>
        </div>
      </div>

      <div className="flex gap-2 text-xs">
        {(["all", "promote", "warn", "terminate"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full font-semibold transition ${filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {f === "all" ? "All" : f === "promote" ? "Promotable" : f === "warn" ? "Warnings" : "At Risk"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-start">Employee</th>
              <th className="px-4 py-3 text-start">Role / Level</th>
              <th className="px-4 py-3 text-center">Avg %</th>
              <th className="px-4 py-3 text-center">Months</th>
              <th className="px-4 py-3 text-center">Warnings</th>
              <th className="px-4 py-3 text-start">Recommendation</th>
              <th className="px-4 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {loading && (<tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading evaluations…</td></tr>)}
            {!loading && filtered.length === 0 && (<tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 italic">No employees in this band.</td></tr>)}
            {!loading && filtered.map((e) => (
              <tr key={e.userId} className="hover:bg-gray-50">
                <td className="px-4 py-3"><div className="font-bold text-gray-900">{e.userName}</div><div className="text-xs text-gray-500">{e.userEmail}</div></td>
                <td className="px-4 py-3 capitalize"><div>{e.role.replace(/_/g, " ")}</div><div className="text-xs text-gray-500">{e.level || "—"}</div></td>
                <td className="px-4 py-3 text-center font-bold">{e.monthsEvaluated > 0 ? `${e.avgAchievementPct.toFixed(0)}%` : "—"}</td>
                <td className="px-4 py-3 text-center">{e.monthsEvaluated}</td>
                <td className="px-4 py-3 text-center">{e.warningCount}{e.terminationFlag && <span className="ms-1 text-red-500">⚑</span>}</td>
                <td className="px-4 py-3">
                  {e.recommendation === "promote" && <span className="text-emerald-700 font-bold">Promote{e.nextLevel ? ` → ${e.nextLevel}` : ""}{e.nextRole ? ` (${e.nextRole.replace(/_/g, " ")})` : ""}</span>}
                  {e.recommendation === "warn" && <span className="text-amber-700 font-bold">Issue Warning</span>}
                  {e.recommendation === "terminate" && <span className="text-red-700 font-bold">Terminate</span>}
                  {e.recommendation === "none" && <span className="text-gray-400">No action</span>}
                  {e.recommendationReason && <div className="text-xs text-gray-500 mt-0.5">{e.recommendationReason}</div>}
                </td>
                <td className="px-4 py-3 text-end space-x-1 whitespace-nowrap">
                  {e.recommendation === "promote" && (
                    <button disabled={busy === e.userId} onClick={() => runAction(e, "promote")} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 disabled:opacity-50">Promote</button>
                  )}
                  <button disabled={busy === e.userId} onClick={() => runAction(e, "warn")} className="px-2 py-1 bg-amber-500 text-white rounded text-xs font-bold hover:bg-amber-600 disabled:opacity-50">Warn</button>
                  <button disabled={busy === e.userId} onClick={() => runAction(e, "terminate")} className="px-2 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 disabled:opacity-50">Terminate</button>
                  {(e.warningCount > 0 || e.terminationFlag) && (
                    <button disabled={busy === e.userId} onClick={() => runAction(e, "clear")} className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs font-bold hover:bg-slate-300 disabled:opacity-50">Clear</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Documents Tab — HR can view, upload, and delete employee documents.
// ─────────────────────────────────────────────────────────────────────
export function DocumentsTab({ employees }: { employees: any[] }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listDocuments(selectedUser === "all" ? {} : { userId: selectedUser })
      .then((d: any) => setDocs(d.documents || []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [selectedUser]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    setUploading(true);
    try {
      await createDocument({ userId: form.get("userId"), name: form.get("name"), fileUrl: form.get("fileUrl") });
      setShowUpload(false);
      load();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete document "${name}"?`)) return;
    await deleteDocument(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
        <FileText className="w-5 h-5 text-slate-500" />
        <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
          <option value="all">All employees</option>
          {employees.map((emp: any) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
        <button onClick={() => setShowUpload(true)} className="ms-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Upload Document
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-start">Document</th>
              <th className="px-4 py-3 text-start">Employee</th>
              <th className="px-4 py-3 text-start">Uploaded</th>
              <th className="px-4 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {loading && (<tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>)}
            {!loading && docs.length === 0 && (<tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">No documents found.</td></tr>)}
            {!loading && docs.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-bold text-gray-900">{d.name}</td>
                <td className="px-4 py-3"><div>{d.user?.name}</div><div className="text-xs text-gray-500 capitalize">{(d.user?.role || "").replace(/_/g, " ")}</div></td>
                <td className="px-4 py-3 text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-end space-x-2">
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold hover:bg-blue-100">View</a>
                  <button onClick={() => handleDelete(d.id, d.name)} className="p-1.5 bg-red-50 hover:bg-red-100 rounded transition" title="Delete">
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Upload Document</h3>
              <button onClick={() => setShowUpload(false)} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Employee *</label>
                <select name="userId" required className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Select employee</option>
                  {employees.map((emp: any) => (<option key={emp.id} value={emp.id}>{emp.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Document Name *</label>
                <input name="name" required placeholder="Contract / CV / ID" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">File URL *</label>
                <input name="fileUrl" required type="url" placeholder="https://drive.google.com/..." className="w-full border rounded-lg px-3 py-2 text-sm" />
                <p className="text-xs text-gray-500 mt-1">Paste a shared cloud-storage link (Drive, Dropbox, S3 signed URL, etc.).</p>
              </div>
              <div className="pt-4 border-t flex gap-3">
                <button type="button" onClick={() => setShowUpload(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={uploading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition">
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Leave Requests Tab — HR reviews and approves/rejects leave & remote work.
// ─────────────────────────────────────────────────────────────────────
export function LeaveRequestsTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"Pending" | "Approved" | "Rejected" | "all">("Pending");

  const load = useCallback(() => {
    setLoading(true);
    listHrRequests()
      .then((d: any) => setRequests(Array.isArray(d) ? d : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, status: "Approved" | "Rejected") => {
    setBusy(id);
    try {
      await updateHrRequest(id, { status });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e) {
      notify(e instanceof HttpError ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const counts = {
    Pending: requests.filter((r) => r.status === "Pending").length,
    Approved: requests.filter((r) => r.status === "Approved").length,
    Rejected: requests.filter((r) => r.status === "Rejected").length,
  };
  const filtered = requests.filter((r) => statusFilter === "all" || r.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        {(["Pending", "Approved", "Rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-full font-semibold transition ${statusFilter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {f === "all" ? "All" : `${f} (${counts[f]})`}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <ul className="divide-y">
          {loading && <li className="px-6 py-8 text-center text-gray-400">Loading requests…</li>}
          {!loading && filtered.length === 0 && <li className="px-6 py-8 text-center text-gray-400 italic">No requests in this band.</li>}
          {!loading && filtered.map((req) => (
            <li key={req.id} className="px-6 py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">{req.user?.name}</span>
                  <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded capitalize text-gray-600">{(req.user?.role || "").replace(/_/g, " ")}</span>
                </div>
                <p className="text-sm font-medium mt-1 text-gray-700">
                  <span className="text-blue-600">{req.type}</span>
                  {" • "}{new Date(req.date).toLocaleDateString()}
                  {req.duration ? ` • ${req.duration}` : ""}
                </p>
                {req.reason && <p className="text-sm text-gray-500 mt-1 italic">&quot;{req.reason}&quot;</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${req.status === "Approved" ? "bg-green-100 text-green-700" : req.status === "Rejected" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                  {req.status}
                </span>
                {req.status === "Pending" && (
                  <div className="flex gap-2">
                    <button disabled={busy === req.id} onClick={() => decide(req.id, "Approved")} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50" title="Approve"><Check className="w-4 h-4" /></button>
                    <button disabled={busy === req.id} onClick={() => decide(req.id, "Rejected")} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50" title="Reject"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const RECRUITMENT_STAGES = ["New", "HR_Interview", "Department_Interview", "Offer", "Hired", "Rejected"];

// ─────────────────────────────────────────────────────────────────────
// Recruitment Tab — applicant pipeline (kanban) backed by JobApplicant.
// ─────────────────────────────────────────────────────────────────────
export function RecruitmentTab() {
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listApplicants()
      .then((d: any) => setApplicants(d?.data || []))
      .catch(() => setApplicants([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const move = async (id: string, status: string) => {
    setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await updateApplicant(id, { status });
    } catch (e) {
      notify(e instanceof HttpError ? e.message : "Update failed");
      load();
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    setSaving(true);
    try {
      await createApplicant({
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        roleApplied: form.get("roleApplied"),
        notes: form.get("notes") || null,
      });
      setShowAdd(false);
      load();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Failed to add applicant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{applicants.length} applicants in pipeline</p>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Add Applicant
        </button>
      </div>

      {loading ? (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-400">Loading pipeline…</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {RECRUITMENT_STAGES.map((stage) => {
            const stageApps = applicants.filter((a) => a.status === stage);
            return (
              <div key={stage} className="flex-shrink-0 w-72 bg-gray-50 rounded-xl border border-gray-200 flex flex-col max-h-[560px]">
                <div className="p-3 border-b bg-gray-100 rounded-t-xl font-semibold text-gray-700 flex justify-between items-center text-sm">
                  <span>{stage.replace(/_/g, " ")}</span>
                  <span className="bg-white text-xs px-2 py-0.5 rounded-full border">{stageApps.length}</span>
                </div>
                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                  {stageApps.map((app) => (
                    <div key={app.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <h4 className="font-bold text-gray-900 text-sm">{app.name}</h4>
                        <select value={app.status} onChange={(e) => move(app.id, e.target.value)} title="Change stage" className="text-[10px] border rounded px-1 py-0.5 bg-slate-50">
                          {RECRUITMENT_STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                        </select>
                      </div>
                      <p className="text-xs text-blue-600 font-medium">{app.roleApplied}</p>
                      <p className="text-xs text-gray-500 mt-1">{app.phone}</p>
                      {app.notes && <p className="text-xs text-gray-400 mt-2 line-clamp-2 italic">&quot;{app.notes}&quot;</p>}
                    </div>
                  ))}
                  {stageApps.length === 0 && <div className="text-center text-xs text-gray-400 py-4 italic border-2 border-dashed rounded-lg">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">New Applicant</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={add} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input name="name" required className="w-full border rounded p-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input name="email" type="email" required className="w-full border rounded p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input name="phone" required className="w-full border rounded p-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Applied For *</label>
                <input name="roleApplied" required placeholder="e.g. Senior Sales Agent" className="w-full border rounded p-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Notes</label>
                <textarea name="notes" rows={2} className="w-full border rounded p-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving…" : "Save Applicant"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Employee Self-Service — request leave, track own requests & documents.
// ─────────────────────────────────────────────────────────────────────
