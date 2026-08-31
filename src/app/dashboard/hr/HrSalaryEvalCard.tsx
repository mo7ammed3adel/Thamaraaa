"use client";

import { TrendingUp, CalendarClock, Percent } from "lucide-react";

function fmt(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-GB");
}
function money(v?: number | null) {
  return v != null ? `SAR ${Number(v).toLocaleString()}` : "—";
}

export default function HrSalaryEvalCard({ info }: { info: any }) {
  if (!info) return null;
  const rules: any[] = info.commission?.rules || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Salary & evaluation */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-600" /> Salary & Evaluation</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 border rounded-xl p-3"><p className="text-[11px] font-bold uppercase text-slate-400">Current Salary</p><p className="text-lg font-black text-slate-800">{money(info.currentSalary)}</p></div>
          <div className="bg-slate-50 border rounded-xl p-3"><p className="text-[11px] font-bold uppercase text-slate-400">Next Increase</p><p className="text-sm font-bold text-slate-800">{info.increaseType === "fixed" ? money(info.increaseValue) : `${info.increaseValue || 0}%`}</p><p className="text-[10px] text-slate-400">min eval {info.minEvalForIncrease || 0}%</p></div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-sm border rounded-xl px-3 py-2">
            <span className="flex items-center gap-2 text-slate-600"><CalendarClock className="w-4 h-4 text-blue-500" /> Next Evaluation ({info.evaluationFrequency})</span>
            <span className="text-end"><span className="font-bold text-slate-800">{fmt(info.nextEvaluationDate)}</span>{info.daysUntilEvaluation != null && <span className="block text-[11px] text-slate-400">in {info.daysUntilEvaluation} days</span>}</span>
          </div>
          <div className="flex items-center justify-between text-sm border rounded-xl px-3 py-2">
            <span className="flex items-center gap-2 text-slate-600"><TrendingUp className="w-4 h-4 text-emerald-500" /> Next Salary Review</span>
            <span className="text-end"><span className="font-bold text-slate-800">{fmt(info.nextReviewDate)}</span>{info.daysUntilReview != null && <span className="block text-[11px] text-slate-400">in {info.daysUntilReview} days</span>}</span>
          </div>
        </div>
      </div>

      {/* Commission */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><Percent className="w-5 h-5 text-violet-600" /> My Commission</h2>
        {!info.commission?.enabled ? (
          <p className="text-sm text-slate-400 italic">Your department has no commission scheme.</p>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-2">Type: <span className="font-bold capitalize">{info.commission.type}</span> (inherited from your department)</p>
            {rules.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No tiers configured.</p>
            ) : (
              <ul className="space-y-1.5">
                {rules.map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                    <span className="text-slate-600">Sales ≥ <span className="font-semibold">{Number(r.minSales).toLocaleString()}</span></span>
                    <span className="font-bold text-violet-700">{r.pct}%</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
