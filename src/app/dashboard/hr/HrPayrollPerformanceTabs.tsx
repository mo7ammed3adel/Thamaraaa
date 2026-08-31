import { useState, useEffect, useCallback } from "react";
import { notify } from "@/components/toast";
import { DollarSign, Star, ClipboardList, Check, Trash2, Plus } from "lucide-react";
import { HttpError } from "@/client/transport/http";
import { currentMonth } from "@/lib/payslip";
import {
  createReview,
  deleteOnboardingTask,
  listOnboarding,
  listPayroll,
  listReviews,
  manageOnboarding,
  toggleOnboarding,
} from "@/client/api/hr";

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
        <span className="text-xs text-gray-400 ms-auto">Net = base + bonus − approved attendance deductions</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-start">Employee</th>
              <th className="px-6 py-3 text-start">Role</th>
              <th className="px-6 py-3 text-end">Base</th>
              <th className="px-6 py-3 text-end">Bonus</th>
              <th className="px-6 py-3 text-end">Deductions</th>
              <th className="px-6 py-3 text-end">Net (SAR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {loading && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading payroll…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 italic">No salary records found.</td></tr>}
            {!loading && rows.map((r: any) => (
              <tr key={r.userId} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-bold text-gray-900">{r.name}{r.status === "Inactive" && <span className="ms-2 text-[10px] text-red-500 font-bold uppercase">Inactive</span>}</td>
                <td className="px-6 py-3 text-gray-500 capitalize">{(r.role || "").replace(/_/g, " ")}</td>
                <td className="px-6 py-3 text-end text-gray-700">{r.baseSalary.toLocaleString()}</td>
                <td className="px-6 py-3 text-end text-emerald-700">{r.bonuses ? `+${r.bonuses.toLocaleString()}` : "—"}</td>
                <td className="px-6 py-3 text-end text-red-600">{r.deductions ? `−${r.deductions.toLocaleString()}` : "—"}</td>
                <td className="px-6 py-3 text-end font-black text-gray-900">{r.net.toLocaleString()}</td>
              </tr>
            ))}
            {!loading && totals && rows.length > 0 && (
              <tr className="bg-slate-50 font-bold">
                <td className="px-6 py-3" colSpan={2}>Totals ({rows.length})</td>
                <td className="px-6 py-3 text-end">{totals.baseSalary.toLocaleString()}</td>
                <td className="px-6 py-3 text-end text-emerald-700">+{totals.bonuses.toLocaleString()}</td>
                <td className="px-6 py-3 text-end text-red-600">−{totals.deductions.toLocaleString()}</td>
                <td className="px-6 py-3 text-end text-gray-900">{totals.net.toLocaleString()}</td>
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
          <div className="space-y-3 max-h-[640px] overflow-y-auto pe-1">
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
