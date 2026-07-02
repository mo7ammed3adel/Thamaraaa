import { useState, useEffect, useCallback } from "react";
import { notify } from "@/components/toast";
import { CalendarDays, DollarSign, Clock, FileText, ClipboardList, Check, Star } from "lucide-react";
import { HttpError } from "@/client/transport/http";
import { computeLeaveBalance } from "@/lib/leaveBalance";
import { currentMonth } from "@/lib/payslip";
import {
  getPayslip,
  listCentralHrRequests,
  listDocuments,
  listHrRequests,
  listOnboarding,
  listReviews,
  submitCentralHrRequest,
  submitLeaveRequest,
} from "@/client/api/hr";

export function SelfServiceSection() {
  const [requests, setRequests] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [payslip, setPayslip] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [onboarding, setOnboarding] = useState<any[]>([]);
  const [centralRequestTypes, setCentralRequestTypes] = useState<any[]>([]);
  const [centralRequests, setCentralRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ type: "Leave", date: "", duration: "1 Day", reason: "" });
  const [centralForm, setCentralForm] = useState({ typeKey: "", priority: "medium", details: "" });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      listHrRequests().then((d: any) => (Array.isArray(d) ? d : [])).catch(() => []),
      listDocuments().then((d: any) => d?.documents || []).catch(() => []),
      getPayslip().then((d: any) => d).catch(() => null),
      listReviews().then((d: any) => d?.reviews || []).catch(() => []),
      listOnboarding().then((d: any) => d?.tasks || []).catch(() => []),
      listCentralHrRequests().then((d: any) => d).catch(() => ({ requestTypes: [], requests: [] })),
    ]).then(([reqs, documents, slip, reviewList, onboardingList, central]) => {
      setRequests(reqs);
      setDocs(documents);
      setPayslip(slip);
      setReviews(reviewList);
      setOnboarding(onboardingList);
      setCentralRequestTypes(central?.requestTypes || []);
      setCentralRequests(central?.requests || []);
      setCentralForm((prev) => ({ ...prev, typeKey: prev.typeKey || central?.requestTypes?.[0]?.key || "" }));
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

  const submitCentral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centralForm.typeKey) { notify("No request type is available yet"); return; }
    setSubmitting(true);
    try {
      await submitCentralHrRequest({
        typeKey: centralForm.typeKey,
        priority: centralForm.priority,
        payload: { details: centralForm.details },
      });
      notify("Request submitted");
      setCentralForm((prev) => ({ ...prev, details: "" }));
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

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-indigo-600" /> Request Center</h2>
        <form onSubmit={submitCentral} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={centralForm.typeKey} onChange={(e) => setCentralForm({ ...centralForm, typeKey: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
              {centralRequestTypes.length === 0 && <option value="">No request types yet</option>}
              {centralRequestTypes.map((type) => <option key={type.key} value={type.key}>{type.name}</option>)}
            </select>
            <select value={centralForm.priority} onChange={(e) => setCentralForm({ ...centralForm, priority: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
              {["low", "medium", "high", "urgent"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </div>
          <textarea value={centralForm.details} onChange={(e) => setCentralForm({ ...centralForm, details: e.target.value })} rows={3} placeholder="Request details..." className="w-full border rounded-lg px-3 py-2 text-sm" />
          <button type="submit" disabled={submitting || !centralForm.typeKey} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg disabled:opacity-50 transition">
            Submit Request
          </button>
        </form>
        <ul className="divide-y mt-4">
          {centralRequests.slice(0, 5).map((request) => (
            <li key={request.id} className="py-2 flex justify-between items-center text-sm">
              <span className="text-gray-700"><span className="font-semibold text-indigo-600">{request.typeName}</span> - {request.requestNumber}</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${request.slaStatus === "overdue" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>{request.status}</span>
            </li>
          ))}
          {!loading && centralRequests.length === 0 && <li className="py-2 text-sm text-gray-400 italic">No central requests yet.</li>}
        </ul>
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
