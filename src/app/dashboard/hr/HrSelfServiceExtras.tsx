"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet, MessageSquareWarning } from "lucide-react";
import { notify } from "@/components/toast";
import { HttpError } from "@/client/transport/http";
import { listComplaints, listSalaryAdvances, submitComplaint, submitSalaryAdvance } from "@/client/api/hrRequests";

function tone(s?: string | null) {
  const v = (s || "").toLowerCase();
  if (["approved", "paid", "resolved"].includes(v)) return "bg-emerald-100 text-emerald-700";
  if (v.startsWith("pending") || ["open", "in_progress"].includes(v)) return "bg-amber-100 text-amber-700";
  if (["rejected", "closed"].includes(v)) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}
const Badge = ({ s }: { s?: string | null }) => <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${tone(s)}`}>{(s || "").replace(/_/g, " ")}</span>;

export default function HrSelfServiceExtras() {
  const [advances, setAdvances] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listSalaryAdvances().then((d: any) => setAdvances(d?.advances || [])).catch(() => setAdvances([]));
    listComplaints().then((d: any) => setComplaints(d?.complaints || [])).catch(() => setComplaints([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const submitAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    setBusy(true);
    try {
      await submitSalaryAdvance({ amount: fd.get("amount"), reason: fd.get("reason") });
      notify("Salary advance request submitted");
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err) { notify(err instanceof HttpError ? err.message : "Failed to submit"); }
    finally { setBusy(false); }
  };

  const submitComp = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    setBusy(true);
    try {
      await submitComplaint({ subject: fd.get("subject"), details: fd.get("details"), visibility: fd.get("visibility") });
      notify("Complaint submitted");
      form.reset();
      load();
    } catch (err) { notify(err instanceof HttpError ? err.message : "Failed to submit"); }
    finally { setBusy(false); }
  };

  const input = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Salary advance */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><Wallet className="w-5 h-5 text-emerald-600" /> Salary Advance</h2>
        <form onSubmit={submitAdvance} className="space-y-2 mb-3">
          <div className="grid grid-cols-3 gap-2">
            <input name="amount" type="number" min="1" required placeholder="Amount (SAR)" className={`col-span-1 ${input}`} />
            <input name="reason" required placeholder="Reason" className={`col-span-2 ${input}`} />
          </div>
          <button type="submit" disabled={busy} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">Request Advance</button>
        </form>
        <ul className="divide-y">
          {advances.length === 0 && <li className="py-2 text-sm text-gray-400 italic">No requests yet.</li>}
          {advances.slice(0, 5).map((a) => (
            <li key={a.id} className="py-2 flex justify-between items-center text-sm">
              <span className="text-gray-700">SAR {Number(a.amount).toLocaleString()} · {a.reason}</span>
              <Badge s={a.status} />
            </li>
          ))}
        </ul>
      </div>

      {/* Complaint */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><MessageSquareWarning className="w-5 h-5 text-amber-600" /> Submit a Complaint</h2>
        <form onSubmit={submitComp} className="space-y-2 mb-3">
          <input name="subject" required placeholder="Subject" className={input} />
          <textarea name="details" required rows={2} placeholder="Describe your complaint…" className={input} />
          <select name="visibility" defaultValue="hr_only" className={`${input} bg-white`}>
            <option value="hr_only">Visible to HR only</option>
            <option value="dept_head">HR + Department Head</option>
            <option value="team_leader">HR + Team Leader</option>
            <option value="everyone">Everyone involved</option>
          </select>
          <button type="submit" disabled={busy} className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">Submit Complaint</button>
        </form>
        <ul className="divide-y">
          {complaints.length === 0 && <li className="py-2 text-sm text-gray-400 italic">No complaints yet.</li>}
          {complaints.slice(0, 5).map((c) => (
            <li key={c.id} className="py-2 flex justify-between items-center text-sm">
              <span className="text-gray-700 truncate max-w-[70%]">{c.subject}</span>
              <Badge s={c.status} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
