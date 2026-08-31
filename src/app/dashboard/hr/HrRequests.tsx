"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, Plane, Wallet, MessageSquareWarning } from "lucide-react";
import { notify } from "@/components/toast";
import { HttpError } from "@/client/transport/http";
import { listHrRequests, updateHrRequest } from "@/client/api/hr";
import { actOnSalaryAdvance, listComplaints, listSalaryAdvances, updateComplaint } from "@/client/api/hrRequests";
import { useTranslator } from "@/components/i18n/LocaleProvider";

function tone(s?: string | null) {
  const v = (s || "").toLowerCase();
  if (["approved", "paid", "resolved", "active"].includes(v)) return "bg-emerald-100 text-emerald-700";
  if (v.startsWith("pending") || ["open", "in_progress"].includes(v)) return "bg-amber-100 text-amber-700";
  if (["rejected", "closed"].includes(v)) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}
const Badge = ({ s }: { s?: string | null }) => <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${tone(s)}`}>{(s || "").replace(/_/g, " ")}</span>;

export default function HrRequests() {
  const t = useTranslator();
  const [tab, setTab] = useState<"leave" | "advances" | "complaints">("leave");
  const [leave, setLeave] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    listHrRequests().then((d: any) => setLeave(Array.isArray(d) ? d : [])).catch(() => setLeave([]));
    listSalaryAdvances().then((d: any) => setAdvances(d?.advances || [])).catch(() => setAdvances([]));
    listComplaints().then((d: any) => setComplaints(d?.complaints || [])).catch(() => setComplaints([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (id: string, fn: () => Promise<any>) => {
    setBusy(id);
    try { await fn(); load(); }
    catch (e) { notify(e instanceof HttpError ? e.message : "Action failed"); }
    finally { setBusy(null); }
  };

  const counts = {
    leave: leave.filter((r) => r.status === "Pending").length,
    advances: advances.filter((a) => String(a.status).startsWith("pending")).length,
    complaints: complaints.filter((c) => c.status !== "closed" && c.status !== "resolved").length,
  };

  const TABS = [
    { id: "leave", label: "Leave", icon: <Plane className="w-4 h-4" />, n: counts.leave },
    { id: "advances", label: "Salary Advances", icon: <Wallet className="w-4 h-4" />, n: counts.advances },
    { id: "complaints", label: "Complaints", icon: <MessageSquareWarning className="w-4 h-4" />, n: counts.complaints },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${tab === t.id ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"}`}>
            {t.icon} {t.label}
            {t.n > 0 && <span className="text-[10px] font-bold bg-amber-400 text-amber-900 rounded-full px-1.5">{t.n}</span>}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {tab === "leave" && (
          <ul className="divide-y">
            {leave.length === 0 && <li className="px-6 py-8 text-center text-slate-400 italic">No leave requests.</li>}
            {leave.map((r) => (
              <li key={r.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><span className="font-bold text-slate-900">{r.user?.name}</span><span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded capitalize text-slate-500">{(r.user?.role || "").replace(/_/g, " ")}</span></div>
                  <p className="text-sm text-slate-600 mt-1"><span className="text-blue-600 font-semibold">{r.type}</span> • {new Date(r.date).toLocaleDateString()}{r.duration ? ` • ${r.duration}` : ""}{r.reason ? ` • ${r.reason}` : ""}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge s={r.status} />
                  {r.status === "Pending" && (
                    <div className="flex gap-2">
                      <button disabled={busy === r.id} onClick={() => run(r.id, () => updateHrRequest(r.id, { status: "Approved" }))} className="p-1.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                      <button disabled={busy === r.id} onClick={() => run(r.id, () => updateHrRequest(r.id, { status: "Rejected" }))} className="p-1.5 bg-rose-100 text-rose-700 rounded hover:bg-rose-200 disabled:opacity-50"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "advances" && (
          <ul className="divide-y">
            {advances.length === 0 && <li className="px-6 py-8 text-center text-slate-400 italic">No salary advances.</li>}
            {advances.map((a) => (
              <li key={a.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-900">{a.employeeName}</span>
                  <p className="text-sm text-slate-600 mt-1">SAR {Number(a.amount).toLocaleString()} • {a.reason}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge s={a.status} />
                  {String(a.status).startsWith("pending") && (
                    <div className="flex gap-2">
                      <button disabled={busy === a.id} onClick={() => run(a.id, () => actOnSalaryAdvance(a.id, { action: "approve" }))} className="px-2 py-1 text-xs font-bold bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50">{t("common.approve")}</button>
                      <button disabled={busy === a.id} onClick={() => run(a.id, () => actOnSalaryAdvance(a.id, { action: "reject" }))} className="px-2 py-1 text-xs font-bold bg-rose-100 text-rose-700 rounded hover:bg-rose-200 disabled:opacity-50">{t("common.reject")}</button>
                    </div>
                  )}
                  {a.status === "approved" && (
                    <button disabled={busy === a.id} onClick={() => run(a.id, () => actOnSalaryAdvance(a.id, { action: "markPaid" }))} className="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50">Mark Paid</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "complaints" && (
          <ul className="divide-y">
            {complaints.length === 0 && <li className="px-6 py-8 text-center text-slate-400 italic">No complaints.</li>}
            {complaints.map((c) => (
              <li key={c.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="font-bold text-slate-900">{c.subject}</span><span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">{c.employeeName}</span><span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded">{(c.visibility || "").replace(/_/g, " ")}</span></div>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{c.details}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge s={c.status} />
                  <select disabled={busy === c.id} value={c.status} onChange={(e) => run(c.id, () => updateComplaint(c.id, { status: e.target.value }))} className="border rounded-lg px-2 py-1 text-xs bg-white">
                    {["open", "in_progress", "resolved", "closed"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
