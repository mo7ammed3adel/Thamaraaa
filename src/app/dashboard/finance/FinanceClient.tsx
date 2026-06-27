"use client";

import { useState, useEffect, useCallback } from "react";
import { DollarSign, AlertCircle, FileText, CheckCircle2, Calculator, Download, Plus, X, Trash2, Lock } from "lucide-react";
import { formatSar } from "@/shared/formatters/currency";
import { formatDate } from "@/shared/formatters/date";
import { HttpError } from "@/client/transport/http";
import {
  getFinanceOverview,
  listCommissions,
  recomputeCommissions,
  updateCommission,
  updateInstallment,
} from "@/client/api/finance";

export default function FinanceClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeFilter, setActiveFilter] = useState("all");

  const loadData = useCallback(() => {
    setLoading(true);
    getFinanceOverview()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMarkInstallmentPaid = async (id: string) => {
    if (!confirm("Are you sure you want to mark this installment as Paid?")) return;
    
    await updateInstallment(id, { isPaid: true });
    
    // Refresh Data
    loadData();
  };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-b-2 border-green-600 rounded-full"></div></div>;
  if (!data?.overview) return <div className="text-center p-12 text-gray-500">Failed to load finance data.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveFilter("all")}
          className={`cursor-pointer transition-all p-5 rounded-2xl border-2 shadow-sm ${
            activeFilter === "all" ? "border-gray-500 bg-gray-100" : "border-transparent bg-white hover:bg-gray-50 border-gray-200"
          }`}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Total Revenue</p>
          <p className="text-3xl font-black text-gray-900">{formatSar(data.overview.totalRevenue)}</p>
        </div>
        <div 
          onClick={() => setActiveFilter("fully_paid")}
          className={`cursor-pointer transition-all p-5 rounded-2xl border-2 shadow-sm ${
            activeFilter === "fully_paid" ? "border-green-500 bg-green-100" : "border-transparent bg-green-50 hover:bg-green-100 border-green-200"
          }`}>
          <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">Total Collected</p>
          <p className="text-3xl font-black text-green-700">{formatSar(data.overview.totalCollected)}</p>
        </div>
        <div 
          onClick={() => setActiveFilter("partial")}
          className={`cursor-pointer transition-all p-5 rounded-2xl border-2 shadow-sm ${
            activeFilter === "partial" ? "border-amber-500 bg-amber-100" : "border-transparent bg-amber-50 hover:bg-amber-100 border-amber-200"
          }`}>
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Total Remaining</p>
          <p className="text-3xl font-black text-amber-700">{formatSar(data.overview.totalRemaining)}</p>
        </div>
        <div 
          onClick={() => { setActiveTab("installments"); setActiveFilter("overdue"); }}
          className={`cursor-pointer transition-all p-5 rounded-2xl border-2 shadow-sm ${
            activeFilter === "overdue" && activeTab === "installments" ? "border-blue-500 bg-blue-100" : "border-transparent bg-blue-50 hover:bg-blue-100 border-blue-200"
          }`}>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Upcoming Installments</p>
          <p className="text-3xl font-black text-blue-700">{formatSar(data.overview.upcomingAmounts)}</p>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button onClick={() => { setActiveTab("overview"); setActiveFilter("all"); }} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "overview" ? "border-green-600 text-green-600" : "border-transparent text-gray-500"}`}>
          💰 All Deals
        </button>
        <button onClick={() => { setActiveTab("installments"); setActiveFilter("all"); }} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "installments" ? "border-green-600 text-green-600" : "border-transparent text-gray-500"}`}>
          📆 Pending Installments
        </button>
        <button onClick={() => { setActiveTab("commissions"); setActiveFilter("all"); }} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "commissions" ? "border-green-600 text-green-600" : "border-transparent text-gray-500"}`}>
          🧮 Commissions
        </button>
      </div>

      {activeTab === "commissions" && <CommissionsTab />}

      {activeTab === "overview" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Client & Agent</th>
                <th className="px-6 py-3 text-left">Total Value</th>
                <th className="px-6 py-3 text-left">Collected</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {data.deals.map((d: any) => {
                const installmentsPaid = (d.installments || [])
                  .filter((inst: any) => inst.isPaid)
                  .reduce((sum: number, inst: any) => sum + inst.amount, 0);
                const collected = (d.firstAmount || 0) + installmentsPaid;

                const isFullyPaid = collected >= d.totalAmount;
                if (activeFilter === "fully_paid" && !isFullyPaid) return null;
                if (activeFilter === "partial" && isFullyPaid) return null;

                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{d.lead?.name || "Unknown"}</div>
                      <div className="text-xs text-gray-500">Agent: {d.salesAgent?.name || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">{formatSar(d.totalAmount)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-green-600">{formatSar(collected)}</span>
                        {collected < d.totalAmount && (
                          <span className="text-xs text-amber-600 mt-1">Remaining: {formatSar(d.totalAmount - collected)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${collected >= d.totalAmount ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {collected >= d.totalAmount ? "Fully Paid" : "Partial"}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {data.deals.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">No deals recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "installments" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.pendingInstallments.map((inst: any) => {
            const isOverdue = new Date(inst.dueDate) < new Date();
            return (
              <div key={inst.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{inst.deal?.lead?.name || "Unknown Client"}</h3>
                    <p className="text-xs font-semibold text-gray-500 uppercase">Installment #{inst.installmentNumber}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isOverdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {isOverdue ? "Overdue" : "Pending"}
                  </span>
                </div>
                <div className="mb-4">
                  <p className="text-3xl font-black text-gray-900">{formatSar(inst.amount)}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">Due: {formatDate(inst.dueDate)}</p>
                </div>
                <button 
                  onClick={() => handleMarkInstallmentPaid(inst.id)}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-sm transition flex justify-center items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Mark as Paid
                </button>
              </div>
            )
          })}
          {data.pendingInstallments.length === 0 && (
            <div className="col-span-full bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-500 italic">
              No pending installments found!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Commissions Tab — per-month breakdown of sales-agent payouts.
// Implements the spec's Net Target formula, tier brackets, achievement
// multipliers, bonuses/deductions editing, finalize, and Excel export.
// ─────────────────────────────────────────────────────────────────────
function CommissionsTab() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState<string>(defaultMonth);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [config, setConfig] = useState<{ tiers: any[]; gatewayFeePct: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listCommissions(month)
      .then((d) => {
        const payload = d as any;
        setCommissions(payload.commissions || []);
        setConfig(payload.config || null);
      })
      .catch(() => setCommissions([]))
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // Live refresh: when Super Admin changes a finance rule, the server recomputes
  // and broadcasts on `finance-channel` so this view updates without a manual reload.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    if (!key) return;
    let client: any = null;
    let channel: any = null;
    (async () => {
      try {
        const PusherModule = await import("pusher-js");
        const Pusher = PusherModule.default;
        client = new Pusher(key, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu" });
        channel = client.subscribe("finance-channel");
        channel.bind("config-updated", () => load());
      } catch (e) {
        console.error("Finance live-update subscription failed:", e);
      }
    })();
    return () => {
      if (channel) channel.unbind_all();
      if (client) client.unsubscribe("finance-channel");
    };
  }, [load]);

  const recompute = async () => {
    setBusy("recompute");
    try {
      await recomputeCommissions({ month });
      load();
    } catch (error) {
      alert(error instanceof HttpError ? error.message : "Recompute failed");
    } finally {
      setBusy(null);
    }
  };

  const finalize = async (c: any) => {
    if (!confirm(`Finalize ${c.user.name}'s ${month} commission? This payout becomes immutable.`)) return;
    setBusy(c.id);
    await updateCommission(c.id, { finalized: true });
    setBusy(null);
    load();
  };

  const exportXlsx = () => {
    window.location.href = `/api/finance/commissions/export?month=${month}`;
  };

  const totalPayout = commissions.reduce((s, c) => s + c.netPayout, 0);
  const totalNet = commissions.reduce((s, c) => s + c.netTarget, 0);
  const finalizedCount = commissions.filter((c) => c.finalized).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
        <Calculator className="w-5 h-5 text-slate-500" />
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white" />
        <button onClick={recompute} disabled={busy === "recompute"} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
          {busy === "recompute" ? "Recomputing…" : "Recompute Month"}
        </button>
        <button onClick={exportXlsx} className="ml-auto px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
          <Download className="w-4 h-4" /> Export XLSX
        </button>
      </div>

      {/* Formula reminder */}
      {config && (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-700 leading-relaxed">
          <div className="font-bold text-slate-900 mb-1">Net Target Formula (per spec)</div>
          <code className="block bg-white p-2 rounded border">Net = Cash × 1.0 + (Tabby/Tamara × {(1 - config.gatewayFeePct).toFixed(2)})</code>
          <div className="mt-2">Tiers: {config.tiers.map((t, i) => (
            <span key={i} className="inline-block bg-white border rounded px-2 py-0.5 mr-1.5 mb-1">{t.minNet.toLocaleString()}–{t.maxNet ? t.maxNet.toLocaleString() : "∞"}: {(t.pct * 100).toFixed(2)}%</span>
          ))}</div>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Net Achieved (Total)</p>
          <p className="text-3xl font-black text-gray-900">SAR {totalNet.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2">Total Payout</p>
          <p className="text-3xl font-black text-emerald-700">SAR {totalPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200 shadow-sm">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Finalized</p>
          <p className="text-3xl font-black text-blue-700">{finalizedCount} / {commissions.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Agent</th>
              <th className="px-4 py-3 text-right">Monthly Target</th>
              <th className="px-4 py-3 text-right">Net Achieved</th>
              <th className="px-4 py-3 text-center">Achievement %</th>
              <th className="px-4 py-3 text-right">Commission</th>
              <th className="px-4 py-3 text-right">Bonus / Deduct</th>
              <th className="px-4 py-3 text-right">Net Payout</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {loading && (<tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>)}
            {!loading && commissions.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 italic">No commissions for {month}. Click "Recompute Month".</td></tr>
            )}
            {!loading && commissions.map((c) => {
              const target = c.user.hrRecord?.monthlyTarget || 0;
              const pct = target > 0 ? (c.netTarget / target) * 100 : 0;
              const bonusesSum = sumJson(c.bonuses);
              const deductionsSum = sumJson(c.deductions);
              return (
                <tr key={c.id} className={`hover:bg-gray-50 ${c.finalized ? "bg-emerald-50/40" : ""}`}>
                  <td className="px-4 py-3"><div className="font-bold text-gray-900">{c.user.name}</div><div className="text-xs text-gray-500">{c.user.level || "—"}</div></td>
                  <td className="px-4 py-3 text-right">SAR {target.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold">SAR {c.netTarget.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${pct >= 100 ? "text-emerald-700" : pct >= 50 ? "text-amber-700" : "text-red-600"}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">SAR {c.commissionAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}<div className="text-xs text-gray-400">{(c.commissionPct * 100).toFixed(2)}%</div></td>
                  <td className="px-4 py-3 text-right text-xs">
                    {bonusesSum > 0 && <div className="text-emerald-600">+{bonusesSum.toLocaleString()}</div>}
                    {deductionsSum > 0 && <div className="text-red-600">−{deductionsSum.toLocaleString()}</div>}
                    {bonusesSum === 0 && deductionsSum === 0 && <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-black">SAR {c.netPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                    {c.finalized ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold"><Lock className="w-3 h-3" /> Finalized</span>
                    ) : (
                      <>
                        <button onClick={() => setEditing(c)} className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-bold">Edit</button>
                        <button disabled={busy === c.id} onClick={() => finalize(c)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold disabled:opacity-50">Finalize</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && <BonusDeductionModal commission={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function sumJson(json: string | null): number {
  if (!json) return 0;
  try {
    const items = JSON.parse(json);
    if (!Array.isArray(items)) return 0;
    return items.reduce((s: number, it: any) => s + (Number(it.amount) || 0), 0);
  } catch {
    return 0;
  }
}

function BonusDeductionModal({ commission, onClose, onSaved }: { commission: any; onClose: () => void; onSaved: () => void }) {
  const [bonuses, setBonuses] = useState<{ reason: string; amount: number }[]>(safeParse(commission.bonuses));
  const [deductions, setDeductions] = useState<{ reason: string; amount: number }[]>(safeParse(commission.deductions));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateCommission(commission.id, { bonuses, deductions });
      onSaved();
      onClose();
    } catch (error) {
      alert(error instanceof HttpError ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Bonuses & Deductions — {commission.user.name}</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><X className="w-4 h-4" /></button>
        </div>

        <LineItemEditor title="Bonuses" colorClass="emerald" items={bonuses} setItems={setBonuses} />
        <LineItemEditor title="Deductions" colorClass="red" items={deductions} setItems={setDeductions} />

        <div className="pt-4 border-t flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LineItemEditor({ title, colorClass, items, setItems }: { title: string; colorClass: "emerald" | "red"; items: { reason: string; amount: number }[]; setItems: (v: any) => void }) {
  // Static class names so Tailwind's JIT doesn't purge them.
  const addBtnClass = colorClass === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
  return (
    <div className="my-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-sm text-gray-700">{title}</h4>
        <button onClick={() => setItems([...items, { reason: "", amount: 0 }])} className={`px-2 py-1 ${addBtnClass} rounded text-xs font-bold flex items-center gap-1`}>
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-xs text-gray-400 italic">No {title.toLowerCase()} yet.</p>}
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <input value={it.reason} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))} placeholder="Reason" className="flex-1 border rounded px-2 py-1 text-sm" />
            <input type="number" value={it.amount} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x)))} placeholder="Amount" className="w-32 border rounded px-2 py-1 text-sm text-right" />
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="p-1.5 bg-red-50 hover:bg-red-100 rounded">
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function safeParse(json: string | null): { reason: string; amount: number }[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
