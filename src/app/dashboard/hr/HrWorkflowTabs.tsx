import { useState, useEffect, useCallback } from "react";
import { notify } from "@/components/toast";
import { useRouter } from "next/navigation";
import { UserX, Award, AlertTriangle, FileText, Plus, Trash2, X, Check, CalendarDays, DollarSign, Clock, ClipboardList, Star } from "lucide-react";
import { HttpError } from "@/client/transport/http";
import { computeLeaveBalance } from "@/lib/leaveBalance";
import { currentMonth } from "@/lib/payslip";
import {
  createApplicant,
  createDocument,
  createReview,
  deleteDocument,
  deleteOnboardingTask,
  getPayslip,
  listApplicants,
  listDocuments,
  listHrRequests,
  listOnboarding,
  listPayroll,
  listPromotionEvaluations,
  listReviews,
  manageOnboarding,
  runAutoEvaluations,
  runPromotionAction,
  submitLeaveRequest,
  toggleOnboarding,
  updateApplicant,
  updateHrRequest,
} from "@/client/api/hr";

// ─────────────────────────────────────────────────────────────────────
// Promotion Engine Tab — surfaces per-employee performance evaluations
// and the spec actions: promote / warn / terminate / clear flags.
// ─────────────────────────────────────────────────────────────────────
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
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Role / Level</th>
              <th className="px-4 py-3 text-center">Avg %</th>
              <th className="px-4 py-3 text-center">Months</th>
              <th className="px-4 py-3 text-center">Warnings</th>
              <th className="px-4 py-3 text-left">Recommendation</th>
              <th className="px-4 py-3 text-right">Actions</th>
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
                <td className="px-4 py-3 text-center">{e.warningCount}{e.terminationFlag && <span className="ml-1 text-red-500">⚑</span>}</td>
                <td className="px-4 py-3">
                  {e.recommendation === "promote" && <span className="text-emerald-700 font-bold">Promote{e.nextLevel ? ` → ${e.nextLevel}` : ""}{e.nextRole ? ` (${e.nextRole.replace(/_/g, " ")})` : ""}</span>}
                  {e.recommendation === "warn" && <span className="text-amber-700 font-bold">Issue Warning</span>}
                  {e.recommendation === "terminate" && <span className="text-red-700 font-bold">Terminate</span>}
                  {e.recommendation === "none" && <span className="text-gray-400">No action</span>}
                  {e.recommendationReason && <div className="text-xs text-gray-500 mt-0.5">{e.recommendationReason}</div>}
                </td>
                <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
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
        <button onClick={() => setShowUpload(true)} className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Upload Document
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Document</th>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Uploaded</th>
              <th className="px-4 py-3 text-right">Actions</th>
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
                <td className="px-4 py-3 text-right space-x-2">
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
export function SelfServiceSection() {
  const [requests, setRequests] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [payslip, setPayslip] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [onboarding, setOnboarding] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ type: "Leave", date: "", duration: "1 Day", reason: "" });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      listHrRequests().then((d: any) => (Array.isArray(d) ? d : [])).catch(() => []),
      listDocuments().then((d: any) => d?.documents || []).catch(() => []),
      getPayslip().then((d: any) => d).catch(() => null),
      listReviews().then((d: any) => d?.reviews || []).catch(() => []),
      listOnboarding().then((d: any) => d?.tasks || []).catch(() => []),
    ]).then(([reqs, documents, slip, reviewList, onboardingList]) => {
      setRequests(reqs);
      setDocs(documents);
      setPayslip(slip);
      setReviews(reviewList);
      setOnboarding(onboardingList);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) { notify("Please choose a date"); return; }
    setSubmitting(true);
    try {
      await submitLeaveRequest(form);
      notify("Request submitted to HR");
      setForm({ type: "Leave", date: "", duration: "1 Day", reason: "" });
      load();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const balance = computeLeaveBalance(requests, new Date().getFullYear());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Request Leave */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-blue-600" /> Request Leave / Remote</h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                <option value="Leave">Leave</option>
                <option value="Remote">Remote Work</option>
                <option value="Permission">Permission</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Duration</label>
            <select value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
              <option>Half Day</option>
              <option>1 Day</option>
              <option>2 Days</option>
              <option>3 Days</option>
              <option>1 Week</option>
              <option>2 Hours</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason</label>
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} placeholder="Optional note for HR…" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={submitting} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50 transition">
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </form>
      </div>

      {/* Payslip + Leave Balance + My Requests + My Documents */}
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-700 text-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2"><DollarSign className="w-5 h-5" /> My Payslip</h2>
            <span className="text-xs text-slate-300">{payslip?.month || currentMonth()}</span>
          </div>
          {payslip?.status === "ok" ? (
            <>
              <p className="text-3xl font-black">{payslip.payslip.net.toLocaleString()} <span className="text-sm font-medium text-slate-300">SAR net</span></p>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
                <div><p className="text-slate-300">Base</p><p className="font-bold">{payslip.payslip.baseSalary.toLocaleString()}</p></div>
                <div><p className="text-emerald-300">Bonus</p><p className="font-bold text-emerald-300">+{payslip.payslip.bonuses.toLocaleString()}</p></div>
                <div><p className="text-red-300">Deduct.</p><p className="font-bold text-red-300">−{payslip.payslip.deductions.toLocaleString()}</p></div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-300 italic">{loading ? "Loading…" : "No salary record on file yet."}</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-emerald-600" /> Annual Leave Balance <span className="text-xs font-normal text-gray-400">({new Date().getFullYear()})</span></h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 border rounded-lg p-3">
              <p className="text-[10px] uppercase font-bold text-slate-400">Quota</p>
              <p className="text-2xl font-black text-slate-800">{balance.quota}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-[10px] uppercase font-bold text-amber-500">Used</p>
              <p className="text-2xl font-black text-amber-700">{balance.used}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
              <p className="text-[10px] uppercase font-bold text-emerald-500">Remaining</p>
              <p className="text-2xl font-black text-emerald-700">{balance.remaining}</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Counts approved Leave-type requests this year against a {balance.quota}-day annual quota.</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><Clock className="w-5 h-5 text-amber-600" /> My Requests</h2>
          {loading ? <p className="text-sm text-gray-400">Loading…</p> : requests.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No requests yet.</p>
          ) : (
            <ul className="divide-y">
              {requests.slice(0, 6).map((r) => (
                <li key={r.id} className="py-2 flex justify-between items-center text-sm">
                  <span className="text-gray-700"><span className="font-semibold text-blue-600">{r.type}</span> • {new Date(r.date).toLocaleDateString()}{r.duration ? ` • ${r.duration}` : ""}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${r.status === "Approved" ? "bg-green-100 text-green-700" : r.status === "Rejected" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><FileText className="w-5 h-5 text-slate-500" /> My Documents</h2>
          {loading ? <p className="text-sm text-gray-400">Loading…</p> : docs.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No documents on file.</p>
          ) : (
            <ul className="divide-y">
              {docs.map((d) => (
                <li key={d.id} className="py-2 flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-700">{d.name}</span>
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold hover:bg-blue-100">View</a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-indigo-600" /> My Onboarding</h2>
          {loading ? <p className="text-sm text-gray-400">Loading…</p> : onboarding.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No checklist assigned.</p>
          ) : (
            <ul className="space-y-1.5">
              {onboarding.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${t.completed ? "bg-emerald-500 border-emerald-500" : "border-gray-300"}`}>{t.completed && <Check className="w-3 h-3 text-white" />}</span>
                  <span className={t.completed ? "text-gray-400 line-through" : "text-gray-700"}>{t.title}</span>
                  <span className="ml-auto text-[9px] uppercase font-bold text-gray-300">{t.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><Star className="w-5 h-5 text-amber-500" /> My Reviews</h2>
          {loading ? <p className="text-sm text-gray-400">Loading…</p> : reviews.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No reviews yet.</p>
          ) : (
            <ul className="divide-y">
              {reviews.slice(0, 4).map((r) => (
                <li key={r.id} className="py-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">{r.period}</span>
                    <span className="flex items-center gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />)}</span>
                  </div>
                  {r.strengths && <p className="text-xs text-gray-500 mt-1"><span className="font-semibold">Strengths:</span> {r.strengths}</p>}
                  {r.goals && <p className="text-xs text-gray-500 mt-0.5"><span className="font-semibold">Goals:</span> {r.goals}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Payroll Tab — computed monthly payslips for all employees (HR view).
// ─────────────────────────────────────────────────────────────────────
export function PayrollTab() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listPayroll({ month })
      .then((d: any) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const rows = data?.rows || [];
  const totals = data?.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
        <DollarSign className="w-5 h-5 text-slate-500" />
        <label className="text-sm font-semibold text-gray-600">Month</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
        <span className="text-xs text-gray-400 ml-auto">Net = base + bonus − approved attendance deductions</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-left">Employee</th>
              <th className="px-6 py-3 text-left">Role</th>
              <th className="px-6 py-3 text-right">Base</th>
              <th className="px-6 py-3 text-right">Bonus</th>
              <th className="px-6 py-3 text-right">Deductions</th>
              <th className="px-6 py-3 text-right">Net (SAR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {loading && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading payroll…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 italic">No salary records found.</td></tr>}
            {!loading && rows.map((r: any) => (
              <tr key={r.userId} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-bold text-gray-900">{r.name}{r.status === "Inactive" && <span className="ml-2 text-[10px] text-red-500 font-bold uppercase">Inactive</span>}</td>
                <td className="px-6 py-3 text-gray-500 capitalize">{(r.role || "").replace(/_/g, " ")}</td>
                <td className="px-6 py-3 text-right text-gray-700">{r.baseSalary.toLocaleString()}</td>
                <td className="px-6 py-3 text-right text-emerald-700">{r.bonuses ? `+${r.bonuses.toLocaleString()}` : "—"}</td>
                <td className="px-6 py-3 text-right text-red-600">{r.deductions ? `−${r.deductions.toLocaleString()}` : "—"}</td>
                <td className="px-6 py-3 text-right font-black text-gray-900">{r.net.toLocaleString()}</td>
              </tr>
            ))}
            {!loading && totals && rows.length > 0 && (
              <tr className="bg-slate-50 font-bold">
                <td className="px-6 py-3" colSpan={2}>Totals ({rows.length})</td>
                <td className="px-6 py-3 text-right">{totals.baseSalary.toLocaleString()}</td>
                <td className="px-6 py-3 text-right text-emerald-700">+{totals.bonuses.toLocaleString()}</td>
                <td className="px-6 py-3 text-right text-red-600">−{totals.deductions.toLocaleString()}</td>
                <td className="px-6 py-3 text-right text-gray-900">{totals.net.toLocaleString()}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Performance Tab — HR writes periodic reviews and browses past ones.
// ─────────────────────────────────────────────────────────────────────
export function PerformanceTab({ employees }: { employees: any[] }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("all");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ userId: "", period: currentMonth(), rating: "4", strengths: "", improvements: "", goals: "" });

  const load = useCallback(() => {
    setLoading(true);
    listReviews(filterUser === "all" ? {} : { userId: filterUser })
      .then((d: any) => setReviews(d?.reviews || []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [filterUser]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId) { notify("Select an employee"); return; }
    setSaving(true);
    try {
      await createReview({ ...form, rating: Number(form.rating) });
      notify("Review saved");
      setForm({ userId: "", period: currentMonth(), rating: "4", strengths: "", improvements: "", goals: "" });
      load();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-amber-500" /> New Performance Review</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Employee *</label>
              <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">Select…</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Period</label>
              <input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2026-06" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} onClick={() => setForm({ ...form, rating: String(n) })} className="p-0.5">
                  <Star className={`w-6 h-6 ${n <= Number(form.rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Strengths</label>
            <textarea value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Areas to Improve</label>
            <textarea value={form.improvements} onChange={(e) => setForm({ ...form, improvements: e.target.value })} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Goals</label>
            <textarea value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={saving} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save Review"}</button>
        </form>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-600">Filter</label>
          <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="all">All employees</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </div>
        {loading ? <p className="text-sm text-gray-400">Loading…</p> : reviews.length === 0 ? (
          <div className="bg-white border rounded-xl p-8 text-center text-gray-400 italic">No reviews yet.</div>
        ) : (
          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white border rounded-xl p-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-gray-900">{r.user?.name}</span>
                  <span className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-4 h-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />)}</span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{r.period} • by {r.reviewer?.name} • {new Date(r.createdAt).toLocaleDateString()}</p>
                {r.strengths && <p className="text-sm text-gray-600"><span className="font-semibold">Strengths:</span> {r.strengths}</p>}
                {r.improvements && <p className="text-sm text-gray-600"><span className="font-semibold">Improve:</span> {r.improvements}</p>}
                {r.goals && <p className="text-sm text-gray-600"><span className="font-semibold">Goals:</span> {r.goals}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Onboarding Tab — HR manages per-employee onboarding/offboarding checklists.
// ─────────────────────────────────────────────────────────────────────
export function OnboardingTab({ employees }: { employees: any[] }) {
  const [selectedUser, setSelectedUser] = useState("");
  const [kind, setKind] = useState<"onboarding" | "offboarding">("onboarding");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!selectedUser) { setTasks([]); return; }
    setLoading(true);
    listOnboarding({ userId: selectedUser })
      .then((d: any) => setTasks(d?.tasks || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [selectedUser]);

  useEffect(() => { load(); }, [load]);

  const kindTasks = tasks.filter((t) => t.kind === kind);
  const done = kindTasks.filter((t) => t.completed).length;

  const seed = async () => {
    setBusy(true);
    try {
      await manageOnboarding({ action: "seed", userId: selectedUser, kind });
      load();
    } catch (e) {
      notify(e instanceof HttpError ? e.message : "Failed to create checklist");
    } finally { setBusy(false); }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      await manageOnboarding({ action: "add", userId: selectedUser, kind, title: newTitle.trim() });
      setNewTitle("");
      load();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Failed to add item");
    } finally { setBusy(false); }
  };

  const toggle = async (t: any) => {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: !x.completed } : x)));
    try {
      await toggleOnboarding({ id: t.id, completed: !t.completed });
    } catch (e) {
      notify(e instanceof HttpError ? e.message : "Update failed");
      load();
    }
  };

  const remove = async (id: string) => {
    setTasks((prev) => prev.filter((x) => x.id !== id));
    try {
      await deleteOnboardingTask(id);
    } catch (e) {
      notify(e instanceof HttpError ? e.message : "Delete failed");
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
        <ClipboardList className="w-5 h-5 text-slate-500" />
        <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Select employee…</option>
          {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
        <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
          {(["onboarding", "offboarding"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`px-3 py-1.5 rounded-md capitalize ${kind === k ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>{k}</button>
          ))}
        </div>
      </div>

      {!selectedUser ? (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-400 italic">Select an employee to manage their {kind} checklist.</div>
      ) : loading ? (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          {kindTasks.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-400 italic mb-3">No {kind} checklist yet.</p>
              <button onClick={seed} disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">Create default {kind} checklist</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 capitalize">{kind} progress</span>
                <span className="text-sm font-bold text-indigo-700">{done}/{kindTasks.length}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-2 bg-indigo-500 rounded-full" style={{ width: `${kindTasks.length ? (done / kindTasks.length) * 100 : 0}%` }} />
              </div>
              <ul className="space-y-2">
                {kindTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 group">
                    <button onClick={() => toggle(t)} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${t.completed ? "bg-emerald-500 border-emerald-500" : "border-gray-300 hover:border-indigo-400"}`}>
                      {t.completed && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                    <span className={`text-sm flex-1 ${t.completed ? "text-gray-400 line-through" : "text-gray-700"}`}>{t.title}</span>
                    <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-700" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <form onSubmit={addItem} className="flex gap-2 pt-2 border-t">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={`Add ${kind} item…`} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
            <button type="submit" disabled={busy || !newTitle.trim()} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 disabled:opacity-50">Add</button>
          </form>
        </div>
      )}
    </div>
  );
}
